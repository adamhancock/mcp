#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
    name: 'halopsa-reporting',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
        description: 'List all columns across all tables in the HaloPSA database using information_schema.columns. Returns detailed column information including data types, max length, and nullable status. Use this to explore the complete database schema.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Optional table name to filter columns for a specific table. If not provided, returns columns from all tables.'
            },
            columnFilter: {
              type: 'string',
              description: 'Optional filter to search for specific column names. Example: "id", "name", "date"'
            }
          }
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
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'halopsa_list_tables': {
        const { filter } = args as any;
        
        // Build SQL query with optional WHERE clause for filtering
        let sql = 'SELECT Name FROM sys.tables';
        if (filter) {
          // Use SQL LIKE operator for filtering (case-insensitive)
          const escapedFilter = filter.replace(/'/g, "''");
          sql += ` WHERE LOWER(Name) LIKE '%${escapedFilter.toLowerCase()}%'`;
        }
        
        const result = await haloPSAClient.executeQuery(sql);
        
        // Extract table names from the result - data is in report.rows
        let tables: string[] = [];
        if (result && result.report && result.report.rows && Array.isArray(result.report.rows)) {
          tables = result.report.rows.map((row: any) => row.Name || row.name);
          // Sort alphabetically since we can't use ORDER BY in the SQL
          tables.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                totalTables: tables.length,
                tables: tables
              }, null, 2)
            }
          ]
        };
      }

      case 'halopsa_list_columns': {
        const { tableName, columnFilter } = args as any;
        
        // Build SQL query to get column information from information_schema
        let sql = `SELECT 
          Table_name as [Table Name],
          Column_name as [Column Name],
          Data_type as [Data Type],
          Character_maximum_length as [Max Characters],
          Is_nullable as [Can be Null?]
        FROM information_schema.columns`;
        
        // Add WHERE conditions if filters are provided
        const conditions: string[] = [];
        if (tableName) {
          const escapedTable = tableName.replace(/'/g, "''");
          conditions.push(`LOWER(Table_name) = '${escapedTable.toLowerCase()}'`);
        }
        if (columnFilter) {
          const escapedFilter = columnFilter.replace(/'/g, "''");
          conditions.push(`LOWER(Column_name) LIKE '%${escapedFilter.toLowerCase()}%'`);
        }
        
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        
        const result = await haloPSAClient.executeQuery(sql);
        
        // Process and format the results - data is in report.rows
        let columns: any[] = [];
        if (result && result.report && result.report.rows && Array.isArray(result.report.rows)) {
          columns = result.report.rows.map((row: any) => ({
            tableName: row['Table Name'],
            columnName: row['Column Name'],
            dataType: row['Data Type'],
            maxCharacters: row['Max Characters'],
            nullable: row['Can be Null?']
          }));
          
          // Sort by table name and then column name
          columns.sort((a, b) => {
            const tableCompare = (a.tableName || '').toLowerCase().localeCompare((b.tableName || '').toLowerCase());
            if (tableCompare !== 0) return tableCompare;
            return (a.columnName || '').toLowerCase().localeCompare((b.columnName || '').toLowerCase());
          });
        }
        
        // Group by table if not filtering by specific table
        const response: any = {
          totalColumns: columns.length
        };
        
        if (!tableName && columns.length > 0) {
          // Group columns by table
          const grouped: { [key: string]: any[] } = {};
          columns.forEach(col => {
            if (!grouped[col.tableName]) {
              grouped[col.tableName] = [];
            }
            grouped[col.tableName].push(col);
          });
          response.tableCount = Object.keys(grouped).length;
          response.columnsByTable = grouped;
        } else {
          response.columns = columns;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case 'halopsa_query': {
        const { sql } = args as any;
        
        
        const result = await haloPSAClient.executeQuery(sql);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }


      case 'halopsa_table_info': {
        const { tableName } = args as any;
        
        if (!tableName) {
          throw new Error('Table name is required');
        }
        
        // Use information_schema to get column information for specific table
        const escapedTable = tableName.replace(/'/g, "''");
        const sql = `SELECT 
          Table_name as [Table Name],
          Column_name as [Column Name],
          Data_type as [Data Type],
          Character_maximum_length as [Max Characters],
          Is_nullable as [Can be Null?]
        FROM information_schema.columns
        WHERE LOWER(Table_name) = '${escapedTable.toLowerCase()}'`;
        
        
        const result = await haloPSAClient.executeQuery(sql);
        
        // Process the results - data is in report.rows
        let columns: any[] = [];
        if (result && result.report && result.report.rows && Array.isArray(result.report.rows)) {
          columns = result.report.rows.map((row: any) => ({
            name: row['Column Name'],
            type: row['Data Type'],
            nullable: row['Can be Null?'],
            maxLength: row['Max Characters']
          }));
        }
        
        if (columns.length === 0) {
          throw new Error(`Table ${tableName} not found or has no columns`);
        }
        
        const response = {
          tableName: tableName.toUpperCase(),
          columnCount: columns.length,
          columns: columns
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case 'halopsa_build_query': {
        const { tableName, columns, conditions, orderBy, limit } = args as any;
        
        // Build basic SELECT query
        let query = 'SELECT ';
        if (columns && columns.length > 0) {
          query += columns.join(', ');
        } else {
          query += '*';
        }
        query += ` FROM ${tableName}`;
        
        // Add WHERE clause if conditions provided
        if (conditions && Object.keys(conditions).length > 0) {
          const whereClause = Object.entries(conditions)
            .map(([key, value]) => {
              if (value === null) {
                return `${key} IS NULL`;
              } else if (typeof value === 'string') {
                return `${key} = '${value.replace(/'/g, "''")}'`;
              } else {
                return `${key} = ${value}`;
              }
            })
            .join(' AND ');
          
          query += ` WHERE ${whereClause}`;
        }
        
        // Add ORDER BY if provided (note: may not work in HaloPSA)
        if (orderBy) {
          query += ` ORDER BY ${orderBy}`;
        }
        
        // Add LIMIT if provided (note: may need TOP instead for SQL Server)
        if (limit) {
          // For SQL Server, we should use TOP instead of LIMIT
          // Reconstruct query with TOP
          if (columns && columns.length > 0) {
            query = `SELECT TOP ${limit} ${columns.join(', ')} FROM ${tableName}`;
          } else {
            query = `SELECT TOP ${limit} * FROM ${tableName}`;
          }
          
          // Re-add WHERE clause if it exists
          if (conditions && Object.keys(conditions).length > 0) {
            const whereClause = Object.entries(conditions)
              .map(([key, value]) => {
                if (value === null) {
                  return `${key} IS NULL`;
                } else if (typeof value === 'string') {
                  return `${key} = '${value.replace(/'/g, "''")}'`;
                } else {
                  return `${key} = ${value}`;
                }
              })
              .join(' AND ');
            query += ` WHERE ${whereClause}`;
          }
          
          // Re-add ORDER BY if it exists
          if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: query
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
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