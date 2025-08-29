# ConnectWise RMM MCP Server

MCP server for interacting with ConnectWise RMM API.

## Installation

```bash
npm install @adamhancock/connectwisermm-mcp
```

## Features

- Full authentication support with automatic token refresh
- Schema discovery and filtering tools for exploring the large API
- Generic API call tool for any endpoint
- Specialized tools for common operations (companies, sites, devices, tickets)
- Efficient caching of schema lookups

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Build the project:
```bash
pnpm build
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your ConnectWise RMM credentials
```

## Configuration

Required environment variables:
- `CONNECTWISE_CLIENT_ID`: Your ConnectWise RMM client ID
- `CONNECTWISE_CLIENT_SECRET`: Your ConnectWise RMM client secret
- `CONNECTWISE_BASE_URL`: (Optional) API base URL, defaults to AU platform

## Available Tools

### Schema Discovery
- `connectwise_get_schema_overview`: Get overview of available API endpoints
- `connectwise_get_endpoint_details`: Get detailed info for specific endpoints
- `connectwise_search_endpoints`: Search endpoints by keywords

### Generic API
- `connectwise_api_call`: Make any API call to ConnectWise RMM

### Company Management
- `connectwise_get_companies`: List all companies
- `connectwise_get_company`: Get specific company details
- `connectwise_get_sites`: List sites

### Device Management  
- `connectwise_get_devices`: List devices
- `connectwise_get_device`: Get specific device details

### Ticketing
- `connectwise_get_tickets`: List tickets with filtering
- `connectwise_get_ticket`: Get specific ticket
- `connectwise_create_ticket`: Create new ticket

## Usage with Docker

Add to your Claude Desktop configuration using the Docker image:

```json
{
  "mcpServers": {
    "connectwise-rmm": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--pull", "always",
        "-e", "CONNECTWISE_CLIENT_ID=your_client_id",
        "-e", "CONNECTWISE_CLIENT_SECRET=your_client_secret",
        "-e", "CONNECTWISE_BASE_URL=https://openapi.service.auplatform.connectwise.com",
        "ghcr.io/adamhancock/connectwisermm-mcp:latest"
      ]
    }
  }
}
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "connectwise-rmm": {
      "command": "npx",
      "args": ["@adamhancock/connectwisermm-mcp"],
      "env": {
        "CONNECTWISE_CLIENT_ID": "your_client_id",
        "CONNECTWISE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## API Schema

The server loads the OpenAPI schema from `src/partnerEndpoints7-17.yml` to provide intelligent endpoint discovery and filtering capabilities, similar to the NinjaRMM implementation.