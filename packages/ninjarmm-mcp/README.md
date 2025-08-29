# NinjaRMM MCP Server

An MCP (Model Context Protocol) server that provides access to NinjaOne's RMM API, allowing AI assistants to monitor and manage devices, alerts, policies, and more through natural language interactions.

## Features

- 🔐 Secure OAuth2 authentication with NinjaOne API
- 🖥️ Complete device monitoring and management
- 🚨 Real-time alert monitoring and reset capabilities
- 📋 Policy and configuration management
- 📊 Software inventory tracking across organizations
- 🤖 AI-friendly natural language interactions

## Installation

### NPM

Install the package from npm:

```bash
npm install -g @adamhancock/ninjarmm-mcp
```

### Docker

Pull and run the Docker image:

```bash
docker run -e NINJAONE_CLIENT_ID=your-client-id \
  -e NINJAONE_CLIENT_SECRET=your-client-secret \
  -e NINJAONE_REGION=us \
  -e NINJAONE_SCOPE=monitoring \
  ghcr.io/adamhancock/ninjarmm-mcp:latest
```

## Usage with Claude Desktop

### Using NPM Package

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ninjarmm": {
      "command": "npx",
      "args": ["@adamhancock/ninjarmm-mcp"],
      "env": {
        "NINJAONE_CLIENT_ID": "your-client-id",
        "NINJAONE_CLIENT_SECRET": "your-client-secret",
        "NINJAONE_REGION": "us",
        "NINJAONE_SCOPE": "monitoring"
      }
    }
  }
}
```

### Using Docker

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "ninjarmm": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "NINJAONE_CLIENT_ID=your-client-id",
        "-e", "NINJAONE_CLIENT_SECRET=your-client-secret",
        "-e", "NINJAONE_REGION=us",
        "-e", "NINJAONE_SCOPE=monitoring",
        "ghcr.io/adamhancock/ninjarmm-mcp:latest"
      ]
    }
  }
}
```

## Available Tools

### `ninjaone_get_organizations`

List all organizations:

```typescript
{
  pageSize: 25,  // Optional: number of results per page
  after: "cursor"  // Optional: pagination cursor
}
```

### `ninjaone_get_devices`

List all devices with optional filtering:

```typescript
{
  pageSize: 25,  // Optional: number of results per page
  after: "cursor",  // Optional: pagination cursor
  df: "status:online"  // Optional: device filter query
}
```

### `ninjaone_get_device`

Get detailed information about a specific device:

```typescript
{
  id: 12345  // Device ID
}
```

### `ninjaone_get_alerts`

Get current alerts with optional filtering:

```typescript
{
  status: "OPEN",  // Optional: alert status filter
  since: "2024-01-01T00:00:00Z"  // Optional: get alerts since this date
}
```

### `ninjaone_reset_alert`

Reset a specific alert:

```typescript
{
  uid: "alert-uid-123"  // Alert UID
}
```

### `ninjaone_get_device_software`

Get installed software for a device:

```typescript
{
  deviceId: 12345  // Device ID
}
```

### `ninjaone_get_policies`

List all policies:

```typescript
{
  // No parameters required
}
```

### `ninjaone_run_script`

Execute a script on a device:

```typescript
{
  deviceId: 12345,  // Device ID
  scriptId: 67890,  // Script ID
  parameters: { "param1": "value1" }  // Optional: script parameters
}
```

### `ninjaone_api_call`

Make authenticated calls to any NinjaOne API endpoint:

```typescript
{
  path: "/v2/devices",  // API endpoint path
  method: "GET",  // Optional: HTTP method (default: GET)
  body: { "key": "value" },  // Optional: request body for POST/PUT/PATCH
  queryParams: { "filter": "status:online" }  // Optional: query parameters
}
```

## Common Use Cases

### Monitor Device Status

```
"Show me all offline devices"
"Get alerts from the last 24 hours"
"Which devices need updates?"
```

### Software Management

```
"What software is installed on device 12345?"
"Show me the software inventory for organization 456"
"Find devices with outdated Chrome versions"
```

### Alert Management

```
"Show me all critical alerts"
"Reset alert with UID abc-123"
"What devices have disk space alerts?"
```

## Development

### Run in Development Mode

```bash
pnpm run dev
```

### Test Connection

```bash
node dist/index.js
```

## Getting NinjaOne API Credentials

1. Log into your NinjaOne dashboard
2. Go to **Administration** → **Apps** → **API**
3. Click **Add** to create a new API application
4. Select the appropriate scopes:
   - `monitoring`: Read-only access to monitoring data
   - `management`: Device management capabilities
   - `control`: Full control capabilities
5. Copy the **Client ID** and **Client Secret**

## Supported Regions

- `us`: United States (https://api.ninjarmm.com) - Default
- `eu`: Europe (https://eu.ninjarmm.com)
- `ca`: Canada (https://ca.ninjarmm.com)
- `oc`: Oceania (https://oc.ninjarmm.com)
- `app`: App region (https://app.ninjarmm.com)

## Security Notes

- Never commit `.env` files
- Store credentials securely
- Use read-only scopes when possible
- Rotate API keys regularly

## License

MIT