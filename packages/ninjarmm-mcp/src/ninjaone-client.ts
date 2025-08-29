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

  // Fetch the NinjaOne API schema
  async getApiSchema() {
    try {
      const response = await fetch('https://app.ninjarmm.com/apidocs/NinjaRMM-API-v2.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch API schema: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      throw new Error('Failed to fetch NinjaOne API schema');
    }
  }
}