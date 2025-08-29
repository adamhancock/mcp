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
}