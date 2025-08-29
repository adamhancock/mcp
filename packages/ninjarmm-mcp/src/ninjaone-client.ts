interface AuthConfig {
  clientId: string;
  clientSecret: string;
  region: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class NinjaOneClient {
  private authConfig: AuthConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor(config: AuthConfig) {
    this.authConfig = config;
    this.baseUrl = this.getRegionUrl(config.region);
  }

  private getRegionUrl(region: string): string {
    const regionMap: Record<string, string> = {
      'eu': 'https://eu.ninjarmm.com',
      'us': 'https://api.ninjarmm.com',
      'ca': 'https://ca.ninjarmm.com',
      'oc': 'https://oc.ninjarmm.com',
      'app': 'https://app.ninjarmm.com'
    };
    return regionMap[region.toLowerCase()] || regionMap['us'];
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }
    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/ws/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.authConfig.clientId,
          client_secret: this.authConfig.clientSecret,
          scope: this.authConfig.scope
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data: TokenResponse = await response.json();
      this.accessToken = data.access_token;
      const expiryTime = new Date();
      expiryTime.setSeconds(expiryTime.getSeconds() + data.expires_in - 60);
      this.tokenExpiry = expiryTime;
    } catch (error) {
      throw new Error('Failed to authenticate with NinjaOne API');
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureAuthenticated();
    
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Organizations
  async getOrganizations(pageSize = 25, after?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    return this.request(`/v2/organizations?${params}`);
  }

  async getOrganization(id: number) {
    return this.request(`/v2/organization/${id}`);
  }

  // Devices
  async getDevices(pageSize = 25, after?: string, df?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    if (df) params.append('df', df);
    return this.request(`/v2/devices?${params}`);
  }

  async getDevice(id: number) {
    return this.request(`/v2/device/${id}`);
  }

  async getDevicesByOrganization(orgId: number, pageSize = 25, after?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    return this.request(`/v2/organization/${orgId}/devices?${params}`);
  }

  // Enhanced device search with filter builder
  async searchDevices(
    hostname?: string, 
    status?: string, 
    os?: string, 
    organization?: string, 
    location?: string, 
    deviceType?: string,
    pageSize = 25, 
    after?: string
  ) {
    const filters: string[] = [];
    
    if (hostname) {
      filters.push(`systemName contains "${hostname}"`);
    }
    if (status) {
      const statusMap: Record<string, string> = {
        'ONLINE': 'false',
        'OFFLINE': 'true', 
        'STALE': 'true'
      };
      const offlineValue = statusMap[status.toUpperCase()];
      if (offlineValue !== undefined) {
        filters.push(`offline = ${offlineValue}`);
      }
    }
    if (os) {
      filters.push(`os contains "${os}"`);
    }
    if (organization) {
      // Handle both numeric ID and string name
      if (/^\d+$/.test(organization)) {
        filters.push(`organizationId = ${organization}`);
      } else {
        filters.push(`organizationName contains "${organization}"`);
      }
    }
    if (location) {
      // Handle both numeric ID and string name  
      if (/^\d+$/.test(location)) {
        filters.push(`locationId = ${location}`);
      } else {
        filters.push(`locationName contains "${location}"`);
      }
    }
    if (deviceType) {
      filters.push(`nodeClass = "${deviceType}"`);
    }

    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    if (filters.length > 0) {
      params.append('df', filters.join(' AND '));
    }
    
    return this.request(`/v2/devices?${params}`);
  }

  // Alerts
  async getAlerts(status?: string, since?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (since) params.append('since', since);
    return this.request(`/v2/alerts?${params}`);
  }

  async resetAlert(uid: string) {
    return this.request(`/v2/alert/${uid}`, { method: 'DELETE' });
  }

  // Activities
  async getActivities(pageSize = 25, after?: string, since?: string, type?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    if (since) params.append('since', since);
    if (type) params.append('type', type);
    return this.request(`/v2/activities?${params}`);
  }

  // Device Activities
  async getDeviceActivities(deviceId: number, pageSize = 25, after?: string, since?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    if (since) params.append('since', since);
    return this.request(`/v2/device/${deviceId}/activities?${params}`);
  }

  // Software
  async getDeviceSoftware(deviceId: number) {
    return this.request(`/v2/device/${deviceId}/software`);
  }

  async getOrganizationSoftware(orgId: number) {
    return this.request(`/v2/organization/${orgId}/software`);
  }

  // Policies
  async getPolicies() {
    return this.request('/v2/policies');
  }

  async getPolicy(id: number) {
    return this.request(`/v2/policy/${id}`);
  }

  // Locations
  async getLocations(pageSize = 25, after?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    return this.request(`/v2/locations?${params}`);
  }

  async getLocation(id: number) {
    return this.request(`/v2/location/${id}`);
  }

  // Users
  async getUsers(pageSize = 25, after?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    return this.request(`/v2/users?${params}`);
  }

  // Device Roles
  async getDeviceRoles() {
    return this.request('/v2/device-roles');
  }

  // Custom Fields
  async getDeviceCustomFields(deviceId: number) {
    return this.request(`/v2/device/${deviceId}/custom-fields`);
  }

  async updateDeviceCustomFields(deviceId: number, fields: any) {
    return this.request(`/v2/device/${deviceId}/custom-fields`, {
      method: 'PATCH',
      body: JSON.stringify(fields)
    });
  }

  // Jobs
  async getJobs(pageSize = 25, after?: string, status?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    if (status) params.append('status', status);
    return this.request(`/v2/jobs?${params}`);
  }

  async getJob(id: number) {
    return this.request(`/v2/job/${id}`);
  }

  // Tasks
  async getTasks(pageSize = 25, after?: string) {
    const params = new URLSearchParams({ pageSize: pageSize.toString() });
    if (after) params.append('after', after);
    return this.request(`/v2/tasks?${params}`);
  }

  // Scripts
  async runScript(deviceId: number, scriptId: number, parameters?: any) {
    return this.request(`/v2/device/${deviceId}/script/${scriptId}/run`, {
      method: 'POST',
      body: parameters ? JSON.stringify(parameters) : undefined
    });
  }

  // Webhooks
  async configureWebhook(config: any) {
    return this.request('/v2/webhook', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  async deleteWebhook() {
    return this.request('/v2/webhook', { method: 'DELETE' });
  }

  // Generic API call method
  async makeApiCall(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', body?: any, queryParams?: Record<string, string>) {
    let url = path;
    
    // Add query parameters if provided
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      const paramString = params.toString();
      if (paramString) {
        url += (path.includes('?') ? '&' : '?') + paramString;
      }
    }

    const options: RequestInit = { method };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (typeof body === 'object') {
        options.body = JSON.stringify(body);
      } else {
        options.body = body;
      }
    }

    return this.request(url, options);
  }

  // Get API schema overview with path summary
  async getApiSchemaOverview() {
    try {
      const response = await fetch('https://app.ninjarmm.com/apidocs/NinjaRMM-API-v2.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch API schema: ${response.status} ${response.statusText}`);
      }
      const schema = await response.json();

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
        message: "Use ninjaone_get_api_endpoint_details with a specific path to get full endpoint information"
      };
    } catch (error) {
      throw new Error('Failed to fetch NinjaOne API schema overview');
    }
  }

  // Get detailed information for specific API endpoints
  async getApiEndpointDetails(
    pathPattern: string, 
    summaryOnly: boolean = false,
    includeSchemas: boolean = true,
    maxEndpoints: number = 10,
    includeExamples: boolean = false
  ) {
    try {
      const response = await fetch('https://app.ninjarmm.com/apidocs/NinjaRMM-API-v2.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch API schema: ${response.status} ${response.statusText}`);
      }
      const schema = await response.json();

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
      throw new Error('Failed to fetch NinjaOne API endpoint details');
    }
  }

  private categorizeApiPath(path: string): string {
    if (path.includes('/device')) return 'Device Management';
    if (path.includes('/organization')) return 'Organization Management';
    if (path.includes('/alert')) return 'Alert Management';
    if (path.includes('/policy') || path.includes('/policies')) return 'Policy Management';
    if (path.includes('/software')) return 'Software Management';
    if (path.includes('/patch')) return 'Patch Management';
    if (path.includes('/script')) return 'Script Management';
    if (path.includes('/job')) return 'Job Management';
    if (path.includes('/maintenance')) return 'Maintenance Management';
    if (path.includes('/backup')) return 'Backup Management';
    if (path.includes('/antivirus')) return 'Antivirus Management';
    if (path.includes('/user')) return 'User Management';
    if (path.includes('/location')) return 'Location Management';
    if (path.includes('/activity') || path.includes('/activities')) return 'Activity Management';
    if (path.includes('/webhook')) return 'Webhook Management';
    return 'Other';
  }
}