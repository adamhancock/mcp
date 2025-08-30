#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HaloPSAClient, HaloPSAConfig } from './halopsa-client.js';

// Initialize HaloPSA client with environment variables
const config: HaloPSAConfig = {
  url: process.env.HALOPSA_URL || '',
  clientId: process.env.HALOPSA_CLIENT_ID || '',
  clientSecret: process.env.HALOPSA_CLIENT_SECRET || '',
  tenant: process.env.HALOPSA_TENANT || ''
};

// Validate configuration
if (!config.url || !config.clientId || !config.clientSecret || !config.tenant) {
  console.error('Missing required environment variables. Please check your .env file.');
  console.error('Required: HALOPSA_URL, HALOPSA_CLIENT_ID, HALOPSA_CLIENT_SECRET, HALOPSA_TENANT');
  process.exit(1);
}

const haloPSAClient = new HaloPSAClient(config);

// Create the MCP server
const server = new Server(
  {
    name: 'halopsa-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'halopsa_list_tables',
    description: 'List all available tables in the HaloPSA database by querying sys.tables. Returns a complete list of all tables that can be queried. Use this to discover what data is available before writing queries.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional filter to search for specific tables. Example: "fault", "user", "ticket"'
        }
      }
    }
  },
  {
    name: 'halopsa_list_columns',
    description: 'List columns for a specific table in the HaloPSA database using information_schema.columns. Returns detailed column information including data types, max length, and nullable status.',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Table name to get columns for. Example: FAULTS, USERS, SITE'
        },
        columnFilter: {
          type: 'string',
          description: 'Optional filter to search for specific column names. Example: "id", "name", "date"'
        }
      },
      required: ['tableName']
    }
  },
  {
    name: 'halopsa_query',
    description: 'Execute a SQL query against HaloPSA reporting API. Use this to retrieve data from any HaloPSA table including tickets (FAULTS), users (USERS), sites (SITE), actions (ACTIONS), request types (REQUESTTYPE), and more. Returns the full report response with data rows, column metadata, and available filters.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL query to execute against HaloPSA database. Supports standard SQL syntax including SELECT, JOIN, WHERE, ORDER BY, GROUP BY, etc. Example: SELECT * FROM FAULTS WHERE Status = 1'
        },
        loadReportOnly: {
          type: 'boolean',
          description: 'Whether to load report data only (default: true)',
          default: true
        }
      },
      required: ['sql']
    }
  },
  {
    name: 'halopsa_table_info',
    description: 'Get detailed information about a specific HaloPSA table including all columns, data types, nullable fields, and relationship suggestions. Use this to understand table structure before writing queries.',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to inspect. Example: FAULTS, USERS, SITE, ACTIONS, REQUESTTYPE'
        }
      },
      required: ['tableName']
    }
  },
  {
    name: 'halopsa_build_query',
    description: 'Build a basic SQL query for HaloPSA with a helper that ensures proper syntax. Useful for constructing simple SELECT queries with WHERE conditions, ORDER BY, and LIMIT clauses without writing raw SQL.',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Table to query from (e.g., FAULTS, USERS, SITE)'
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to select (optional, defaults to all). Example: ["Faultid", "Symptom", "Status"]'
        },
        conditions: {
          type: 'object',
          description: 'WHERE conditions as key-value pairs. Example: {"Status": 1, "Priority": 3}'
        },
        orderBy: {
          type: 'string',
          description: 'Column to order results by. Example: "datereported DESC"'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return. Example: 10'
        }
      },
      required: ['tableName']
    }
  },
  {
    name: 'halopsa_list_api_endpoints',
    description: 'List all API endpoints with their paths, methods, and summaries. Use this first to discover available endpoints, then use halopsa_get_api_endpoint_details for full details. Supports pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional category filter (e.g., "Tickets", "Actions", "Clients", "Sites")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of endpoints to return (default: 100)',
          default: 100
        },
        skip: {
          type: 'number',
          description: 'Number of endpoints to skip for pagination (default: 0)',
          default: 0
        }
      }
    }
  },
  {
    name: 'halopsa_get_api_endpoint_details',
    description: 'Get complete details for specific API endpoints including parameters, request/response schemas, and examples. Use after finding endpoints with halopsa_list_api_endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        pathPattern: {
          type: 'string',
          description: 'Path pattern to match endpoints (e.g., "ticket", "action", "client", "agent")'
        },
        summaryOnly: {
          type: 'boolean',
          description: 'Return only basic endpoint information (path, methods, summary) without detailed schemas - ideal for quick API exploration',
          default: false
        },
        includeSchemas: {
          type: 'boolean',
          description: 'Include detailed request/response schemas (default: true, set to false to significantly reduce response size)',
          default: true
        },
        maxEndpoints: {
          type: 'number',
          description: 'Maximum number of endpoints to return (default: 10, max: 50) - helps manage response size',
          default: 10
        },
        includeExamples: {
          type: 'boolean',
          description: 'Include request/response examples (default: false to keep responses smaller)',
          default: false
        }
      },
      required: ['pathPattern']
    }
  },
  {
    name: 'halopsa_search_api_endpoints',
    description: 'Search for API endpoints by keywords. Returns matching endpoints with basic info. Use halopsa_get_api_endpoint_details for full details of specific endpoints. Supports pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find endpoints (searches in paths, summaries, descriptions, and tags)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
          default: 50
        },
        skip: {
          type: 'number',
          description: 'Number of results to skip for pagination (default: 0)',
          default: 0
        }
      },
      required: ['query']
    }
  },
  {
    name: 'halopsa_get_api_schemas',
    description: 'Get API schemas/models from the swagger definition. Shows the structure of request/response objects used by the API endpoints. Supports pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        schemaPattern: {
          type: 'string',
          description: 'Optional pattern to filter schemas by name (e.g., "Ticket", "Action", "Client")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of schemas to return (default: 50)',
          default: 50
        },
        skip: {
          type: 'number',
          description: 'Number of matching schemas to skip for pagination (default: 0)',
          default: 0
        },
        listNames: {
          type: 'boolean',
          description: 'Include list of all matching schema names (default: false, auto-included if ≤20 matches)',
          default: false
        }
      }
    }
  },
  {
    name: 'halopsa_api_call',
    description: 'Make authenticated API calls to any HaloPSA endpoint. Use this after finding the right endpoint with schema tools.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'API endpoint path (e.g., "/api/Ticket", "/api/Actions")'
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method to use',
          default: 'GET'
        },
        body: {
          type: 'object',
          description: 'Request body data for POST/PUT/PATCH requests'
        },
        queryParams: {
          type: 'object',
          description: 'URL query parameters as key-value pairs',
          additionalProperties: { type: 'string' }
        }
      },
      required: ['path']
    }
  }
];

// Handler for listing tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handler for executing tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'halopsa_list_tables': {
        const { filter } = args as any;
        let sql = 'SELECT Name FROM sys.tables';
        if (filter) {
          const escapedFilter = filter.replace(/'/g, "''");
          sql += ` WHERE LOWER(Name) LIKE '%${escapedFilter.toLowerCase()}%'`;
        }
        
        result = await haloPSAClient.executeQuery(sql);
        
        let tables: string[] = [];
        if (result?.report?.rows && Array.isArray(result.report.rows)) {
          tables = result.report.rows.map((row: any) => row.Name || row.name);
          tables.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              tables,
              count: tables.length,
              filter: filter || 'none'
            }, null, 2)
          }]
        };
      }

      case 'halopsa_list_columns': {
        const { tableName, columnFilter } = args as any;
        
        if (!tableName) {
          throw new Error('Table name is required');
        }
        
        let sql = `
          SELECT 
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS c
        `;
        
        const conditions: string[] = [];
        const escapedTable = tableName.replace(/'/g, "''");
        conditions.push(`LOWER(c.TABLE_NAME) = '${escapedTable.toLowerCase()}'`);
        
        if (columnFilter) {
          const escapedFilter = columnFilter.replace(/'/g, "''");
          conditions.push(`LOWER(c.COLUMN_NAME) LIKE '%${escapedFilter.toLowerCase()}%'`);
        }
        
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION';
        
        result = await haloPSAClient.executeQuery(sql);
        
        const columnsByTable: Record<string, any[]> = {};
        if (result?.report?.rows && Array.isArray(result.report.rows)) {
          result.report.rows.forEach((row: any) => {
            const table = row.TABLE_NAME;
            if (!columnsByTable[table]) {
              columnsByTable[table] = [];
            }
            columnsByTable[table].push({
              name: row.COLUMN_NAME,
              type: row.DATA_TYPE,
              maxLength: row.CHARACTER_MAXIMUM_LENGTH,
              nullable: row.IS_NULLABLE === 'YES',
              default: row.COLUMN_DEFAULT
            });
          });
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              columnsByTable,
              totalTables: Object.keys(columnsByTable).length,
              totalColumns: result?.report?.rows?.length || 0,
              filters: {
                table: tableName || 'none',
                column: columnFilter || 'none'
              }
            }, null, 2)
          }]
        };
      }

      case 'halopsa_query': {
        const { sql } = args as any;
        if (!sql) {
          throw new Error('SQL query is required');
        }
        
        result = await haloPSAClient.executeQuery(sql);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'halopsa_table_info': {
        const { tableName } = args as any;
        if (!tableName) {
          throw new Error('Table name is required');
        }
        
        const escapedTable = tableName.replace(/'/g, "''");
        const sql = `
          SELECT 
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            c.ORDINAL_POSITION
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE LOWER(c.TABLE_NAME) = '${escapedTable.toLowerCase()}'
          ORDER BY c.ORDINAL_POSITION
        `;
        
        result = await haloPSAClient.executeQuery(sql);
        
        const columns: any[] = [];
        if (result?.report?.rows && Array.isArray(result.report.rows)) {
          result.report.rows.forEach((row: any) => {
            columns.push({
              position: row.ORDINAL_POSITION,
              name: row.COLUMN_NAME,
              type: row.DATA_TYPE,
              maxLength: row.CHARACTER_MAXIMUM_LENGTH,
              nullable: row.IS_NULLABLE === 'YES',
              default: row.COLUMN_DEFAULT
            });
          });
        }
        
        const commonRelationships: Record<string, string[]> = {
          'FAULTS': ['USERS (via userid)', 'SITE (via siteid)', 'ACTIONS (via faultid)'],
          'USERS': ['FAULTS (via userid)', 'SITE (via siteid)'],
          'SITE': ['CLIENT (via clientid)', 'FAULTS (via siteid)', 'USERS (via siteid)'],
          'ACTIONS': ['FAULTS (via faultid)', 'USERS (via whoagentid)'],
          'CLIENT': ['SITE (via clientid)']
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              table: tableName,
              columns,
              columnCount: columns.length,
              possibleRelationships: commonRelationships[tableName.toUpperCase()] || [],
              exampleQuery: `SELECT TOP 10 * FROM ${tableName}`
            }, null, 2)
          }]
        };
      }

      case 'halopsa_build_query': {
        const { tableName, columns, conditions, orderBy, limit } = args as any;
        if (!tableName) {
          throw new Error('Table name is required');
        }
        
        let query = 'SELECT ';
        
        if (limit && typeof limit === 'number') {
          query += `TOP ${limit} `;
        }
        
        if (columns && Array.isArray(columns) && columns.length > 0) {
          query += columns.join(', ');
        } else {
          query += '*';
        }
        
        query += ` FROM ${tableName}`;
        
        if (conditions && typeof conditions === 'object' && Object.keys(conditions).length > 0) {
          const whereClauses = Object.entries(conditions).map(([key, value]) => {
            if (typeof value === 'string') {
              const escapedValue = value.replace(/'/g, "''");
              return `${key} = '${escapedValue}'`;
            } else if (value === null) {
              return `${key} IS NULL`;
            } else {
              return `${key} = ${value}`;
            }
          });
          query += ' WHERE ' + whereClauses.join(' AND ');
        }
        
        if (orderBy) {
          query += ` ORDER BY ${orderBy}`;
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              generatedQuery: query,
              components: {
                table: tableName,
                columns: columns || ['*'],
                conditions: conditions || {},
                orderBy: orderBy || 'none',
                limit: limit || 'none'
              }
            }, null, 2)
          }]
        };
      }

      case 'halopsa_list_api_endpoints': {
        const { category, limit, skip } = args as any;
        result = await haloPSAClient.listApiEndpoints(category, limit, skip);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'halopsa_get_api_endpoint_details': {
        const { pathPattern, summaryOnly, includeSchemas, maxEndpoints, includeExamples } = args as any;
        if (!pathPattern) {
          throw new Error('Path pattern is required');
        }
        
        result = await haloPSAClient.getApiEndpointDetails(
          pathPattern,
          summaryOnly,
          includeSchemas,
          maxEndpoints,
          includeExamples
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'halopsa_search_api_endpoints': {
        const { query, limit, skip } = args as any;
        if (!query) {
          throw new Error('Search query is required');
        }
        
        result = await haloPSAClient.searchApiEndpoints(query, limit, skip);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'halopsa_get_api_schemas': {
        const { schemaPattern, limit, skip, listNames } = args as any;
        result = await haloPSAClient.getApiSchemas(schemaPattern, limit, skip, listNames);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'halopsa_api_call': {
        const { path, method, body, queryParams } = args as any;
        if (!path) {
          throw new Error('API path is required');
        }
        
        result = await haloPSAClient.makeApiCall(path, method || 'GET', body, queryParams);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  // Test connection silently
  await haloPSAClient.testConnection();
  
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});