# HaloPSA Reporting MCP Server

An MCP (Model Context Protocol) server that provides access to HaloPSA's reporting API, allowing AI assistants to query and analyze HaloPSA data intelligently.

## Features

- 🔐 Secure OAuth2 authentication with HaloPSA API
- 📊 Execute SQL queries against HaloPSA database
- 🔍 Intelligent schema search and query suggestions
- 📋 Complete database schema with 800+ tables
- 🤖 AI-friendly query building assistance
- 🌐 Full API exploration with swagger schema access
- 📖 Browse and search API endpoints with pagination
- 🔧 Direct API calls to any HaloPSA endpoint

## Installation

### NPM

Install the package from npm:

```bash
npm install -g @adamhancock/halopsa-reporting-mcp
```

### Docker

Pull and run the Docker image:

```bash
docker run -e HALOPSA_URL=https://your-instance.halopsa.com \
  -e HALOPSA_CLIENT_ID=your-client-id \
  -e HALOPSA_CLIENT_SECRET=your-client-secret \
  -e HALOPSA_TENANT=your-tenant \
  ghcr.io/adamhancock/halopsa-reporting-mcp:latest
```

## Usage with Claude Desktop

### Using NPM Package

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "halopsa-reporting": {
      "command": "npx",
      "args": ["@adamhancock/halopsa-reporting-mcp"],
      "env": {
        "HALOPSA_URL": "https://your-instance.halopsa.com",
        "HALOPSA_CLIENT_ID": "your-client-id",
        "HALOPSA_CLIENT_SECRET": "your-client-secret",
        "HALOPSA_TENANT": "your-tenant"
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
    "halopsa-reporting": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "HALOPSA_URL=https://your-instance.halopsa.com",
        "-e", "HALOPSA_CLIENT_ID=your-client-id",
        "-e", "HALOPSA_CLIENT_SECRET=your-client-secret",
        "-e", "HALOPSA_TENANT=your-tenant",
        "ghcr.io/adamhancock/halopsa-reporting-mcp:latest"
      ]
    }
  }
}
```

## Available Tools

### Database Query Tools

#### `halopsa_list_tables`

List all available tables in the HaloPSA database:

```typescript
{
  filter: "fault"  // Optional: filter tables by name
}
```

#### `halopsa_list_columns`

List columns for a specific table:

```typescript
{
  tableName: "FAULTS",  // Required: table name
  columnFilter: "email"  // Optional: filter columns by name
}
```

#### `halopsa_query`

Execute SQL queries against the HaloPSA database:

```typescript
{
  sql: "SELECT * FROM FAULTS WHERE Status = 1 LIMIT 10"
}
```

#### `halopsa_table_info`

Get detailed information about a specific table including all columns, data types, and relationships:

```typescript
{
  tableName: "FAULTS"
}
```

#### `halopsa_build_query`

Build SQL queries programmatically with a helper:

```typescript
{
  tableName: "FAULTS",
  columns: ["Faultid", "username", "Symptom"],  // Optional: defaults to all columns
  conditions: { "Status": 1 },  // Optional: WHERE conditions
  orderBy: "datereported DESC",  // Optional: ORDER BY clause
  limit: 10  // Optional: LIMIT clause
}
```

### API Exploration Tools

#### `halopsa_list_api_endpoints`

List all API endpoints with basic information. Supports pagination:

```typescript
{
  category: "Tickets",  // Optional: filter by category
  limit: 100,          // Optional: max results (default: 100)
  skip: 0              // Optional: skip for pagination
}
```

#### `halopsa_get_api_endpoint_details`

Get complete details for specific API endpoints including parameters and schemas:

```typescript
{
  pathPattern: "ticket",      // Required: pattern to match endpoints
  summaryOnly: false,        // Optional: return only basic info
  includeSchemas: true,      // Optional: include request/response schemas
  maxEndpoints: 10,          // Optional: max endpoints to return
  includeExamples: false     // Optional: include examples
}
```

#### `halopsa_search_api_endpoints`

Search for API endpoints by keywords. Supports pagination:

```typescript
{
  query: "create ticket",    // Required: search query
  limit: 50,                // Optional: max results (default: 50)
  skip: 0                   // Optional: skip for pagination
}
```

#### `halopsa_get_api_schemas`

Get API schemas/models from the swagger definition. Supports pagination:

```typescript
{
  schemaPattern: "Ticket",   // Optional: filter schemas by name
  limit: 50,                // Optional: max schemas to return
  skip: 0,                  // Optional: skip for pagination
  listNames: false          // Optional: include all matching schema names
}
```

#### `halopsa_api_call`

Make authenticated API calls to any HaloPSA endpoint:

```typescript
{
  path: "/api/Ticket",       // Required: API endpoint path
  method: "GET",            // Optional: HTTP method (default: GET)
  body: {},                 // Optional: request body for POST/PUT/PATCH
  queryParams: {}           // Optional: URL query parameters
}
```

## Common Queries

### Open Tickets

```sql
SELECT Faultid, username, Symptom, Status, datereported 
FROM FAULTS 
WHERE Status IN (1, 2, 3)
ORDER BY datereported DESC
```

### User List

```sql
SELECT uusername, uemail, usite, uextn 
FROM USERS 
WHERE uinactive = 0
```

### Request Types

```sql
SELECT RTid as RequestTypeId, rtdesc as RequestTypeName 
FROM REQUESTTYPE 
WHERE RTVisible = 1
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

## Schema Information

The MCP includes a complete HaloPSA database schema with:
- 818 tables
- Key tables include:
  - FAULTS (622 columns) - Tickets/Requests
  - USERS (213 columns) - User information
  - SITE (115 columns) - Client/Site data
  - ACTIONS (196 columns) - Ticket actions
  - REQUESTTYPE (332 columns) - Ticket types

## Security Notes

- Never commit `.env` files
- Store credentials securely
- Use read-only API credentials when possible
- Rotate API keys regularly

## License

ISC