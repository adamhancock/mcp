import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  security?: any[];
}

interface OpenAPIPath {
  [method: string]: OpenAPIOperation;
}

interface OpenAPISchema {
  openapi: string;
  info: any;
  servers: any[];
  paths: { [path: string]: OpenAPIPath };
  components?: any;
}

export class ConnectWiseRMMClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private schema: OpenAPISchema | null = null;
  private schemaCache: Map<string, any> = new Map();

  constructor(
    private clientId: string,
    private clientSecret: string,
    private baseUrl: string = 'https://openapi.service.auplatform.connectwise.com'
  ) {
    this.loadSchema();
  }

  private loadSchema(): void {
    try {
      const schemaPath = path.join(__dirname, 'partnerEndpoints7-17.yml');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.schema = yaml.load(schemaContent) as OpenAPISchema;
      console.log(`Loaded OpenAPI schema with ${Object.keys(this.schema.paths).length} endpoints`);
    } catch (error) {
      console.error('Failed to load OpenAPI schema:', error);
    }
  }

  private async authenticate(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: ''
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as TokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async makeRequest(
    method: string,
    path: string,
    data?: any,
    queryParams?: Record<string, any>
  ): Promise<any> {
    await this.authenticate();

    try {
      let url = `${this.baseUrl}${path}`;
      
      if (queryParams && Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(queryParams)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        url += `?${params.toString()}`;
      }

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      throw new Error(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getSchemaOverview(): any {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const pathsByCategory: Record<string, string[]> = {};
    const allTags = new Set<string>();

    for (const [path, pathItem] of Object.entries(this.schema.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && operation !== null) {
          const op = operation as OpenAPIOperation;
          if (op.tags && Array.isArray(op.tags)) {
            op.tags.forEach((tag: string) => {
              allTags.add(tag);
              if (!pathsByCategory[tag]) {
                pathsByCategory[tag] = [];
              }
              pathsByCategory[tag].push(`${method.toUpperCase()} ${path}`);
            });
          }
        }
      }
    }

    return {
      totalEndpoints: Object.keys(this.schema.paths).length,
      categories: Array.from(allTags).sort(),
      pathsByCategory,
      servers: this.schema.servers
    };
  }

  public getEndpointDetails(
    pathPattern: string,
    options: {
      includeSchemas?: boolean;
      includeExamples?: boolean;
      summaryOnly?: boolean;
      maxEndpoints?: number;
    } = {}
  ): any {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const {
      includeSchemas = true,
      includeExamples = false,
      summaryOnly = false,
      maxEndpoints = 10
    } = options;

    const cacheKey = `${pathPattern}-${JSON.stringify(options)}`;
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }

    const matchingEndpoints: any[] = [];
    const pattern = new RegExp(pathPattern, 'i');

    for (const [path, pathItem] of Object.entries(this.schema.paths)) {
      if (!pattern.test(path)) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || operation === null) continue;
        
        const op = operation as OpenAPIOperation;

        const endpoint: any = {
          path,
          method: method.toUpperCase(),
          operationId: op.operationId,
          summary: op.summary,
          description: op.description,
          tags: op.tags || []
        };

        if (!summaryOnly) {
          if (op.parameters) {
            endpoint.parameters = op.parameters;
          }

          if (op.requestBody && includeSchemas) {
            endpoint.requestBody = op.requestBody;
          }

          if (op.responses && includeSchemas) {
            endpoint.responses = {};
            for (const [code, response] of Object.entries(op.responses)) {
              endpoint.responses[code] = {
                description: (response as any).description,
                content: (response as any).content
              };
            }
          }

          if (includeExamples && op.requestBody?.content?.['application/json']?.example) {
            endpoint.example = op.requestBody.content['application/json'].example;
          }

          if (op.security) {
            endpoint.security = op.security;
          }
        }

        matchingEndpoints.push(endpoint);
        if (matchingEndpoints.length >= maxEndpoints) break;
      }
      if (matchingEndpoints.length >= maxEndpoints) break;
    }

    const result = {
      matchCount: matchingEndpoints.length,
      endpoints: matchingEndpoints
    };

    this.schemaCache.set(cacheKey, result);
    return result;
  }

  public searchEndpoints(query: string): string[] {
    if (!this.schema) {
      throw new Error('Schema not loaded');
    }

    const results: string[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    for (const [path, pathItem] of Object.entries(this.schema.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || operation === null) continue;
        
        const op = operation as OpenAPIOperation;

        const searchableText = [
          path,
          method,
          op.operationId || '',
          op.summary || '',
          op.description || '',
          ...(op.tags || [])
        ].join(' ').toLowerCase();

        if (searchTerms.every(term => searchableText.includes(term))) {
          results.push(`${method.toUpperCase()} ${path} - ${op.summary || 'No summary'}`);
        }
      }
    }

    return results;
  }
}