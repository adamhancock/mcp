export interface HaloPSAConfig {
  url: string;
  clientId: string;
  clientSecret: string;
  tenant: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ReportQuery {
  _loadreportonly?: boolean;
  sql: string;
}

export class HaloPSAClient {
  private config: HaloPSAConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: HaloPSAConfig) {
    this.config = config;
  }

  /**
   * Get authentication token from HaloPSA
   */
  private async authenticate(): Promise<void> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    const tokenUrl = `${this.config.url}/auth/token`;
    
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'all'
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
      }

      const tokenData: TokenResponse = await response.json();
      this.accessToken = tokenData.access_token;
      
      // Set token expiry (subtract 60 seconds for safety)
      const expiryMs = (tokenData.expires_in - 60) * 1000;
      this.tokenExpiry = new Date(Date.now() + expiryMs);
      
    } catch (error) {
      throw new Error(`Failed to authenticate with HaloPSA: ${error}`);
    }
  }

  /**
   * Execute a SQL query against the HaloPSA reporting API
   */
  async executeQuery(sql: string): Promise<any> {
    // Ensure we have a valid token
    await this.authenticate();

    const reportUrl = `${this.config.url}/api/Report`;
    const queryUrl = `${reportUrl}?tenant=${this.config.tenant}`;

    const query: ReportQuery = {
      _loadreportonly: true,
      sql: sql
    };

    try {
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([query])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Query execution failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      // HaloPSA returns a single object for reporting API, not an array
      return result;
      
    } catch (error) {
      throw new Error(`Failed to execute query: ${error}`);
    }
  }

  /**
   * Test the connection to HaloPSA
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      // Try a simple query to test the connection
      const result = await this.executeQuery('SELECT 1 as test');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Make a generic API call to HaloPSA
   */
  async makeApiCall(
    path: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<any> {
    // Ensure we have a valid token
    await this.authenticate();

    // Build the full URL
    let url = `${this.config.url}${path}`;
    
    // Add tenant to query params
    const params = new URLSearchParams({ tenant: this.config.tenant });
    
    // Add additional query parameters if provided
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
    }
    
    const paramString = params.toString();
    if (paramString) {
      url += (path.includes('?') ? '&' : '?') + paramString;
    }

    const options: RequestInit = {
      method,
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      throw new Error(`Failed to make API call: ${error}`);
    }
  }

  /**
   * Get API schema overview from the swagger.json file
   */
  async getApiSchemaOverview(): Promise<any> {
    try {
      // Import the swagger.json directly
      const swaggerModule = await import('./swagger.json');
      const schema = swaggerModule.default || swaggerModule;

      // Group paths by category and extract basic info
      const pathGroups: Record<string, string[]> = {};
      const allPaths: { path: string; methods: string[]; summary?: string }[] = [];

      if (schema.paths) {
        Object.entries(schema.paths).forEach(([path, pathObj]: [string, any]) => {
          const methods: string[] = [];
          let summary = '';

          if (pathObj && typeof pathObj === 'object') {
            Object.entries(pathObj).forEach(([method, methodObj]: [string, any]) => {
              methods.push(method.toUpperCase());
              if (!summary && methodObj?.summary) {
                summary = methodObj.summary;
              }
            });
          }

          allPaths.push({ path, methods, summary });

          // Categorize by path pattern
          const category = this.categorizeApiPath(path);
          if (!pathGroups[category]) {
            pathGroups[category] = [];
          }
          pathGroups[category].push(path);
        });
      }

      return {
        info: schema.info,
        servers: schema.servers,
        totalPaths: allPaths.length,
        pathGroups,
        allPaths: allPaths.slice(0, 100), // Limit to first 100 for overview
        message: "Use halopsa_get_api_endpoint_details with a specific path pattern to get full endpoint information"
      };
    } catch (error) {
      throw new Error(`Failed to fetch HaloPSA API schema overview: ${error}`);
    }
  }

  /**
   * Get detailed information for specific API endpoints
   */
  async getApiEndpointDetails(
    pathPattern: string,
    summaryOnly: boolean = false,
    includeSchemas: boolean = true,
    maxEndpoints: number = 10,
    includeExamples: boolean = false
  ): Promise<any> {
    try {
      // Import the swagger.json directly
      const swaggerModule = await import('./swagger.json');
      const schema = swaggerModule.default || swaggerModule;

      const matchingPaths: any = {};
      const pathEntries = Object.entries(schema.paths || {});
      let matchCount = 0;
      
      // Find matching paths and limit results
      for (const [path, pathObj] of pathEntries) {
        if (matchCount >= Math.min(maxEndpoints, 50)) break; // Cap at 50 max
        
        if (path.toLowerCase().includes(pathPattern.toLowerCase())) {
          if (summaryOnly) {
            // Return only basic info for summary mode
            const methods: string[] = [];
            let summary = '';
            
            if (pathObj && typeof pathObj === 'object') {
              Object.entries(pathObj).forEach(([method, methodObj]: [string, any]) => {
                methods.push(method.toUpperCase());
                if (!summary && methodObj?.summary) {
                  summary = methodObj.summary;
                }
              });
            }
            
            matchingPaths[path] = { methods, summary };
          } else {
            // Filter the path object based on options
            const filteredPathObj: any = {};
            
            if (pathObj && typeof pathObj === 'object') {
              Object.entries(pathObj).forEach(([method, methodObj]: [string, any]) => {
                const filteredMethodObj: any = {
                  summary: methodObj?.summary,
                  description: methodObj?.description,
                  operationId: methodObj?.operationId,
                  tags: methodObj?.tags
                };
                
                if (includeSchemas) {
                  filteredMethodObj.parameters = methodObj?.parameters;
                  filteredMethodObj.requestBody = methodObj?.requestBody;
                  filteredMethodObj.responses = methodObj?.responses;
                }
                
                if (includeExamples && methodObj?.examples) {
                  filteredMethodObj.examples = methodObj.examples;
                }
                
                filteredPathObj[method] = filteredMethodObj;
              });
            }
            
            matchingPaths[path] = filteredPathObj;
          }
          matchCount++;
        }
      }

      const result: any = {
        pathPattern,
        matchingPaths,
        matchCount,
        totalMatches: pathEntries.filter(([path]) => 
          path.toLowerCase().includes(pathPattern.toLowerCase())
        ).length,
        limited: matchCount >= Math.min(maxEndpoints, 50)
      };

      // Only include components if schemas are requested and not in summary mode
      if (includeSchemas && !summaryOnly && matchCount > 0) {
        // Include only referenced components to reduce size
        result.components = {
          schemas: schema.components?.schemas ? 
            Object.fromEntries(
              Object.entries(schema.components.schemas).slice(0, 20)
            ) : undefined
        };
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to fetch HaloPSA API endpoint details: ${error}`);
    }
  }

  /**
   * List all API endpoints with basic information
   */
  async listApiEndpoints(category?: string, limit: number = 100, skip: number = 0): Promise<any> {
    try {
      // Import the swagger.json directly
      const swaggerModule = await import('./swagger.json');
      const schema = swaggerModule.default || swaggerModule;
      
      const allMatchingEndpoints: any[] = [];
      
      if ((schema as any).paths) {
        Object.entries((schema as any).paths).forEach(([path, pathObj]: [string, any]) => {
          // Filter by category if provided
          if (category) {
            const pathCategory = this.categorizeApiPath(path);
            if (pathCategory.toLowerCase() !== category.toLowerCase()) {
              return;
            }
          }
          
          if (pathObj && typeof pathObj === 'object') {
            const methods: string[] = [];
            let primarySummary = '';
            
            Object.entries(pathObj).forEach(([method, methodObj]: [string, any]) => {
              methods.push(method.toUpperCase());
              if (!primarySummary && methodObj?.summary) {
                primarySummary = methodObj.summary;
              }
            });
            
            allMatchingEndpoints.push({
              path,
              methods,
              summary: primarySummary,
              category: this.categorizeApiPath(path)
            });
          }
        });
      }
      
      // Sort endpoints by path
      allMatchingEndpoints.sort((a, b) => a.path.localeCompare(b.path));
      
      // Apply pagination
      const paginatedEndpoints = allMatchingEndpoints.slice(skip, skip + limit);
      
      return {
        totalEndpoints: allMatchingEndpoints.length,
        endpoints: paginatedEndpoints,
        returnedCount: paginatedEndpoints.length,
        skipped: skip,
        limited: paginatedEndpoints.length >= limit,
        hasMore: skip + paginatedEndpoints.length < allMatchingEndpoints.length,
        categories: [...new Set(allMatchingEndpoints.map(e => e.category))].sort(),
        message: category ? 
          `Showing ${paginatedEndpoints.length} of ${allMatchingEndpoints.length} endpoints in category "${category}"` :
          `Showing ${paginatedEndpoints.length} endpoints starting from position ${skip}. Total: ${allMatchingEndpoints.length}.`
      };
    } catch (error) {
      throw new Error(`Failed to list API endpoints: ${error}`);
    }
  }

  /**
   * Search API endpoints by keywords
   */
  async searchApiEndpoints(query: string, limit: number = 50, skip: number = 0): Promise<any> {
    try {
      // Import the swagger.json directly
      const swaggerModule = await import('./swagger.json');
      const schema = swaggerModule.default || swaggerModule;
      const matchingEndpoints: any[] = [];
      
      if ((schema as any).paths) {
        Object.entries((schema as any).paths).forEach(([path, pathObj]: [string, any]) => {
          if (pathObj && typeof pathObj === 'object') {
            Object.entries(pathObj).forEach(([method, methodObj]: [string, any]) => {
              // Search in path, summary, description, and tags
              const searchableText = [
                path,
                methodObj?.summary || '',
                methodObj?.description || '',
                ...(methodObj?.tags || [])
              ].join(' ').toLowerCase();
              
              if (searchableText.includes(query.toLowerCase())) {
                matchingEndpoints.push({
                  path,
                  method: method.toUpperCase(),
                  summary: methodObj?.summary,
                  description: methodObj?.description,
                  tags: methodObj?.tags
                });
              }
            });
          }
        });
      }
      
      // Apply pagination
      const paginatedResults = matchingEndpoints.slice(skip, skip + limit);
      
      return {
        query,
        results: paginatedResults,
        returnedCount: paginatedResults.length,
        totalResults: matchingEndpoints.length,
        skipped: skip,
        hasMore: skip + paginatedResults.length < matchingEndpoints.length,
        message: `Found ${matchingEndpoints.length} endpoints matching "${query}". Showing ${paginatedResults.length} starting from position ${skip}.`
      };
    } catch (error) {
      throw new Error(`Failed to search API endpoints: ${error}`);
    }
  }

  /**
   * Get API schemas/models from the swagger definition
   */
  async getApiSchemas(
    schemaPattern?: string, 
    limit: number = 50, 
    skip: number = 0,
    listNames: boolean = false
  ): Promise<any> {
    try {
      // Import the swagger.json directly
      const swaggerModule = await import('./swagger.json');
      const schema = swaggerModule.default || swaggerModule;
      
      const schemas: any = {};
      const matchingSchemaNames: string[] = [];
      let schemaCount = 0;
      let skippedCount = 0;
      
      if ((schema as any).components?.schemas) {
        const allSchemas = (schema as any).components.schemas;
        
        Object.entries(allSchemas).forEach(([name, schemaObj]: [string, any]) => {
          // Filter by pattern if provided
          if (schemaPattern && !name.toLowerCase().includes(schemaPattern.toLowerCase())) {
            return;
          }
          
          matchingSchemaNames.push(name);
          
          // Skip logic
          if (skippedCount < skip) {
            skippedCount++;
            return;
          }
          
          if (schemaCount >= limit) {
            return;
          }
          
          schemas[name] = schemaObj;
          schemaCount++;
        });
      }
      
      // Get total count of all schemas
      const totalSchemaCount = (schema as any).components?.schemas ? 
        Object.keys((schema as any).components.schemas).length : 0;
      
      const result: any = {
        schemas,
        returnedCount: schemaCount,
        matchingCount: matchingSchemaNames.length,
        totalSchemasInAPI: totalSchemaCount,
        skipped: skip,
        limited: schemaCount >= limit,
        hasMore: skip + schemaCount < matchingSchemaNames.length,
        message: schemaPattern ? 
          `Showing ${schemaCount} of ${matchingSchemaNames.length} schemas matching "${schemaPattern}" (skipped ${skip})` : 
          `Showing ${schemaCount} schemas starting from position ${skip}. Total: ${totalSchemaCount}.`
      };
      
      // Only include schema names if requested or if there are few enough
      if (listNames || matchingSchemaNames.length <= 20) {
        result.schemaNames = matchingSchemaNames.sort();
      } else {
        result.hint = `${matchingSchemaNames.length} schemas match. Set listNames=true to see all names.`;
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get API schemas: ${error}`);
    }
  }

  /**
   * Categorize API path for grouping
   */
  private categorizeApiPath(path: string): string {
    const lowerPath = path.toLowerCase();
    
    if (lowerPath.includes('/actions')) return 'Actions';
    if (lowerPath.includes('/ticket')) return 'Tickets';
    if (lowerPath.includes('/agent')) return 'Agents';
    if (lowerPath.includes('/client')) return 'Clients';
    if (lowerPath.includes('/site')) return 'Sites';
    if (lowerPath.includes('/user')) return 'Users';
    if (lowerPath.includes('/asset')) return 'Assets';
    if (lowerPath.includes('/invoice')) return 'Invoicing';
    if (lowerPath.includes('/report')) return 'Reports';
    if (lowerPath.includes('/address')) return 'Addresses';
    if (lowerPath.includes('/appointment')) return 'Appointments';
    if (lowerPath.includes('/project')) return 'Projects';
    if (lowerPath.includes('/contract')) return 'Contracts';
    if (lowerPath.includes('/supplier')) return 'Suppliers';
    if (lowerPath.includes('/product')) return 'Products';
    if (lowerPath.includes('/kb') || lowerPath.includes('/knowledge')) return 'Knowledge Base';
    if (lowerPath.includes('/integration')) return 'Integrations';
    if (lowerPath.includes('/webhook')) return 'Webhooks';
    if (lowerPath.includes('/api')) return 'API Management';
    
    return 'Other';
  }
}