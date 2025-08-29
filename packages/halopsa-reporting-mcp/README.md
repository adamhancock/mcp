# HaloPSA Reporting MCP Server

An MCP (Model Context Protocol) server that provides access to HaloPSA's reporting API, allowing AI assistants to query and analyze HaloPSA data intelligently.

## Features

- 🔐 Secure OAuth2 authentication with HaloPSA API
- 📊 Execute SQL queries against HaloPSA database
- 🔍 Intelligent schema search and query suggestions
- 📋 Complete database schema with 800+ tables
- 🤖 AI-friendly query building assistance

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your HaloPSA credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
HALOPSA_URL=https://your-instance.halopsa.com
HALOPSA_CLIENT_ID=your-client-id
HALOPSA_CLIENT_SECRET=your-client-secret
HALOPSA_TENANT=your-tenant
```

### 3. Build the Project

```bash
pnpm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "halopsa-reporting": {
      "command": "node",
      "args": ["/path/to/halopsa-reporting-mcp/dist/index.js"],
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

## Available Tools

### `halopsa_query`

Execute SQL queries against the HaloPSA database:

```typescript
{
  sql: "SELECT * FROM FAULTS WHERE Status = 1 LIMIT 10",
  loadReportOnly: true
}
```

### `halopsa_schema_search`

Search the database schema:

```typescript
// Find tables
{
  searchType: "tables",
  keywords: ["ticket", "fault"]
}

// Find columns
{
  searchType: "columns",
  keywords: ["email", "user"]
}

// Get query suggestions
{
  searchType: "suggestions",
  queryDescription: "open tickets for this week"
}
```

### `halopsa_table_info`

Get detailed information about a table:

```typescript
{
  tableName: "FAULTS"
}
```

### `halopsa_build_query`

Build SQL queries programmatically:

```typescript
{
  tableName: "FAULTS",
  columns: ["Faultid", "username", "Symptom"],
  conditions: { "Status": 1 },
  orderBy: "datereported DESC",
  limit: 10
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