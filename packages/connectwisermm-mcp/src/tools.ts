import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ConnectWiseRMMClient } from './client.js';

export function createTools(client: ConnectWiseRMMClient): Tool[] {
  return [
    {
      name: 'connectwise_get_schema_overview',
      description: 'Get an overview of the ConnectWise RMM API schema including available endpoint categories, path counts, and basic endpoint information.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'connectwise_get_endpoint_details',
      description: 'Get detailed information for specific API endpoints matching a path pattern. Supports flexible filtering to control response size and detail level.',
      inputSchema: {
        type: 'object',
        properties: {
          pathPattern: {
            type: 'string',
            description: 'Path pattern to match endpoints (e.g., "ticket", "company", "device", "automation")'
          },
          includeSchemas: {
            type: 'boolean',
            description: 'Include detailed request/response schemas (default: true, set to false to reduce response size)'
          },
          includeExamples: {
            type: 'boolean',
            description: 'Include request/response examples (default: false to keep responses smaller)'
          },
          summaryOnly: {
            type: 'boolean',
            description: 'Return only basic endpoint information (path, methods, summary) without detailed schemas'
          },
          maxEndpoints: {
            type: 'number',
            description: 'Maximum number of endpoints to return (default: 10, max: 50)'
          }
        },
        required: ['pathPattern']
      }
    },
    {
      name: 'connectwise_search_endpoints',
      description: 'Search for API endpoints by keywords in path, summary, description, or tags.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find endpoints (searches in paths, summaries, descriptions, and tags)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'connectwise_api_call',
      description: 'Make authenticated API calls to any ConnectWise RMM endpoint. Use this after finding the right endpoint with schema tools.',
      inputSchema: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'HTTP method to use'
          },
          path: {
            type: 'string',
            description: 'API endpoint path (e.g., "/api/platform/v1/company/companies")'
          },
          body: {
            type: 'object',
            description: 'Request body data for POST/PUT/PATCH requests'
          },
          queryParams: {
            type: 'object',
            description: 'URL query parameters as key-value pairs'
          }
        },
        required: ['method', 'path']
      }
    },
    {
      name: 'connectwise_get_companies',
      description: 'Get list of companies in ConnectWise RMM',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'connectwise_get_company',
      description: 'Get details of a specific company by ID',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            description: 'Company ID (UUID format)'
          }
        },
        required: ['companyId']
      }
    },
    {
      name: 'connectwise_get_sites',
      description: 'Get all sites across all companies or for a specific company',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            description: 'Optional company ID to filter sites by company'
          }
        }
      }
    },
    {
      name: 'connectwise_get_devices',
      description: 'Get devices for partner, company, or site',
      inputSchema: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string',
            description: 'Optional client/company ID to filter devices'
          },
          siteId: {
            type: 'string',
            description: 'Optional site ID to filter devices (requires clientId)'
          }
        }
      }
    },
    {
      name: 'connectwise_get_device',
      description: 'Get detailed information for a specific device',
      inputSchema: {
        type: 'object',
        properties: {
          endpointId: {
            type: 'string',
            description: 'Device/endpoint ID (UUID format)'
          }
        },
        required: ['endpointId']
      }
    },
    {
      name: 'connectwise_get_tickets',
      description: 'Get service tickets with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          pageSize: {
            type: 'integer',
            description: 'Number of records per page'
          },
          pageNum: {
            type: 'integer',
            description: 'Page number to fetch'
          },
          companyIds: {
            type: 'string',
            description: 'Comma-separated list of company IDs to filter by'
          },
          statusNames: {
            type: 'string',
            description: 'Comma-separated list of status names to filter by'
          },
          priorityNames: {
            type: 'string',
            description: 'Comma-separated list of priority names to filter by'
          },
          summary: {
            type: 'string',
            description: 'Filter by ticket summary text'
          }
        }
      }
    },
    {
      name: 'connectwise_get_ticket',
      description: 'Get details of a specific ticket',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ticket ID (UUID format)'
          }
        },
        required: ['ticketId']
      }
    },
    {
      name: 'connectwise_create_ticket',
      description: 'Create a new service ticket',
      inputSchema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Ticket summary/title'
          },
          detail: {
            type: 'string',
            description: 'Detailed description of the issue'
          },
          companyId: {
            type: 'string',
            description: 'Company ID for the ticket'
          },
          siteId: {
            type: 'string',
            description: 'Site ID for the ticket'
          },
          priorityId: {
            type: 'string',
            description: 'Priority ID for the ticket'
          },
          statusId: {
            type: 'string',
            description: 'Status ID for the ticket'
          }
        },
        required: ['summary', 'companyId']
      }
    }
  ];
}