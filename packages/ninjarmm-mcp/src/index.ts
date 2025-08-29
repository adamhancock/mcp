#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { NinjaOneClient } from './ninjaone-client.js';

const server = new Server(
  {
    name: 'ninjaone-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let ninjaClient: NinjaOneClient | null = null;

function initializeClient() {
  const clientId = process.env.NINJAONE_CLIENT_ID;
  const clientSecret = process.env.NINJAONE_CLIENT_SECRET;
  const region = process.env.NINJAONE_REGION || 'us';
  const scope = process.env.NINJAONE_SCOPE || 'monitoring';

  if (!clientId || !clientSecret) {
    throw new Error('NINJAONE_CLIENT_ID and NINJAONE_CLIENT_SECRET environment variables are required');
  }

  ninjaClient = new NinjaOneClient({
    clientId,
    clientSecret,
    region,
    scope
  });
}

const tools: Tool[] = [
  {
    name: 'ninjaone_get_organizations',
    description: 'Get a paginated list of organizations with their details, locations, and settings',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25, max: 300)' },
        after: { type: 'string', description: 'Pagination cursor for getting the next page of results' }
      }
    }
  },
  {
    name: 'ninjaone_get_organization',
    description: 'Get detailed information for a specific organization including name, description, locations, and configuration settings',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Unique organization ID number' }
      },
      required: ['id']
    }
  },
  {
    name: 'ninjaone_get_devices',
    description: 'Get a paginated list of all devices with their system information, status, and monitoring details. Supports filtering by various criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25, max: 300)' },
        after: { type: 'string', description: 'Pagination cursor for getting the next page of results' },
        df: { 
          type: 'string', 
          description: 'Device filter query using NinjaRMM syntax. Examples: "hostname contains VDIPool", "status = ONLINE", "organization = 123", "os contains Windows". Operators: =, !=, contains, "not contains", >, <, >=, <=. Fields: hostname, status, organization, os, last_logged_in_user, device_type, location, ip_address, etc.' 
        }
      }
    }
  },
  {
    name: 'ninjaone_get_device',
    description: 'Get comprehensive details for a specific device including system specs, status, installed software, and monitoring information',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Unique device ID number' }
      },
      required: ['id']
    }
  },
  {
    name: 'ninjaone_get_devices_by_org',
    description: 'Get a paginated list of all devices belonging to a specific organization with their system information and status',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: { type: 'number', description: 'Organization ID to filter devices by' },
        pageSize: { type: 'number', description: 'Number of results per page (default: 25, max: 300)' },
        after: { type: 'string', description: 'Pagination cursor for getting the next page of results' }
      },
      required: ['orgId']
    }
  },
  {
    name: 'ninjaone_get_alerts',
    description: 'Get current monitoring alerts for devices including severity, status, and alert details. Useful for identifying active issues.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by alert status (e.g., "OPEN", "CLOSED")' },
        since: { type: 'string', description: 'Get alerts created since this ISO date/time (e.g., "2024-01-01T00:00:00Z")' }
      }
    }
  },
  {
    name: 'ninjaone_reset_alert',
    description: 'Reset/dismiss a specific alert by its unique identifier. This will mark the alert as acknowledged and remove it from active alerts.',
    inputSchema: {
      type: 'object',
      properties: {
        uid: { type: 'string', description: 'Unique alert identifier (UID) of the alert to reset' }
      },
      required: ['uid']
    }
  },
  {
    name: 'ninjaone_get_activities',
    description: 'Get list of activities',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' },
        since: { type: 'string', description: 'Get activities since this date/time' },
        type: { type: 'string', description: 'Activity type filter' }
      }
    }
  },
  {
    name: 'ninjaone_get_device_activities',
    description: 'Get activities for a specific device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'Device ID' },
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' },
        since: { type: 'string', description: 'Get activities since this date/time' }
      },
      required: ['deviceId']
    }
  },
  {
    name: 'ninjaone_get_device_software',
    description: 'Get complete software inventory for a specific device including installed programs, versions, and installation dates',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'Device ID to get software inventory for' }
      },
      required: ['deviceId']
    }
  },
  {
    name: 'ninjaone_get_org_software',
    description: 'Get software inventory for an organization',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: { type: 'number', description: 'Organization ID' }
      },
      required: ['orgId']
    }
  },
  {
    name: 'ninjaone_get_policies',
    description: 'Get list of policies',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'ninjaone_get_policy',
    description: 'Get details of a specific policy',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Policy ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'ninjaone_get_locations',
    description: 'Get list of locations',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' }
      }
    }
  },
  {
    name: 'ninjaone_get_location',
    description: 'Get details of a specific location',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Location ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'ninjaone_get_users',
    description: 'Get list of users',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' }
      }
    }
  },
  {
    name: 'ninjaone_get_device_roles',
    description: 'Get list of device roles',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'ninjaone_get_device_custom_fields',
    description: 'Get custom fields for a device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'Device ID' }
      },
      required: ['deviceId']
    }
  },
  {
    name: 'ninjaone_update_device_custom_fields',
    description: 'Update custom fields for a device',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'Device ID' },
        fields: { type: 'object', description: 'Custom field values to update' }
      },
      required: ['deviceId', 'fields']
    }
  },
  {
    name: 'ninjaone_get_jobs',
    description: 'Get list of jobs',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' },
        status: { type: 'string', description: 'Job status filter' }
      }
    }
  },
  {
    name: 'ninjaone_get_job',
    description: 'Get details of a specific job',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Job ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'ninjaone_get_tasks',
    description: 'Get list of tasks',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Number of results per page (default: 25)' },
        after: { type: 'string', description: 'Cursor for pagination' }
      }
    }
  },
  {
    name: 'ninjaone_run_script',
    description: 'Execute a script on a specific device. Requires appropriate permissions and the device must be online and accessible.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'number', description: 'Target device ID where the script will be executed' },
        scriptId: { type: 'number', description: 'ID of the script to execute' },
        parameters: { type: 'object', description: 'Optional parameters to pass to the script as key-value pairs' }
      },
      required: ['deviceId', 'scriptId']
    }
  },
  {
    name: 'ninjaone_get_api_schema_overview',
    description: 'Get an overview of the NinjaOne API schema including available endpoint categories, path counts, and basic endpoint information.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'ninjaone_get_api_endpoint_details',
    description: 'Get detailed information for specific API endpoints matching a path pattern (e.g., "policy", "patch", "device/{id}/software"). Supports flexible filtering to control response size and detail level. Use summaryOnly for quick exploration, disable schemas for smaller responses, or limit maxEndpoints for focused results.',
    inputSchema: {
      type: 'object',
      properties: {
        pathPattern: { 
          type: 'string', 
          description: 'Path pattern to match endpoints (e.g., "policy", "patch", "device", "maintenance")'
        },
        summaryOnly: {
          type: 'boolean',
          description: 'Return only basic endpoint information (path, methods, summary) without detailed schemas - ideal for quick API exploration'
        },
        includeSchemas: {
          type: 'boolean',
          description: 'Include detailed request/response schemas (default: true, set to false to significantly reduce response size)'
        },
        maxEndpoints: {
          type: 'number',
          description: 'Maximum number of endpoints to return (default: 10, max: 50) - helps manage response size'
        },
        includeExamples: {
          type: 'boolean',
          description: 'Include request/response examples (default: false to keep responses smaller)'
        }
      },
      required: ['pathPattern']
    }
  },
  {
    name: 'ninjaone_search_devices',
    description: 'Search for devices using common filters with simplified syntax. Automatically builds proper filter queries.',
    inputSchema: {
      type: 'object',
      properties: {
        hostname: { type: 'string', description: 'Search by hostname (partial match)' },
        status: { 
          type: 'string', 
          enum: ['ONLINE', 'OFFLINE', 'STALE'],
          description: 'Filter by device status' 
        },
        os: { type: 'string', description: 'Search by operating system (partial match)' },
        organization: { type: 'string', description: 'Organization name or ID' },
        location: { type: 'string', description: 'Location name or ID' },
        deviceType: { 
          type: 'string',
          enum: ['WINDOWS_WORKSTATION', 'WINDOWS_SERVER', 'MAC', 'LINUX'],
          description: 'Filter by device type'
        },
        pageSize: { type: 'number', description: 'Number of results per page (default: 25, max: 300)' },
        after: { type: 'string', description: 'Pagination cursor for getting the next page of results' }
      }
    }
  },
  {
    name: 'ninjaone_api_call',
    description: 'Make authenticated API calls to any NinjaOne endpoint not covered by specific tools. Useful for accessing newer API features or custom endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: 'API endpoint path starting with /v2/ (e.g., "/v2/devices", "/v2/organization/123/devices")' 
        },
        method: { 
          type: 'string', 
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method to use (default: GET)' 
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!ninjaClient) {
    initializeClient();
  }

  if (!ninjaClient) {
    throw new Error('Failed to initialize NinjaOne client');
  }

  const { name, arguments: args } = request.params;

  try {
    let result;
    
    // Type-safe argument access
    const getArg = (key: string, defaultValue?: any) => {
      return args && typeof args === 'object' && key in args ? (args as any)[key] : defaultValue;
    };

    switch (name) {
      case 'ninjaone_get_organizations':
        result = await ninjaClient.getOrganizations(getArg('pageSize'), getArg('after'));
        break;
      case 'ninjaone_get_organization':
        result = await ninjaClient.getOrganization(getArg('id'));
        break;
      case 'ninjaone_get_devices':
        result = await ninjaClient.getDevices(getArg('pageSize'), getArg('after'), getArg('df'));
        break;
      case 'ninjaone_get_device':
        result = await ninjaClient.getDevice(getArg('id'));
        break;
      case 'ninjaone_get_devices_by_org':
        result = await ninjaClient.getDevicesByOrganization(getArg('orgId'), getArg('pageSize'), getArg('after'));
        break;
      case 'ninjaone_get_alerts':
        result = await ninjaClient.getAlerts(getArg('status'), getArg('since'));
        break;
      case 'ninjaone_reset_alert':
        result = await ninjaClient.resetAlert(getArg('uid'));
        break;
      case 'ninjaone_get_activities':
        result = await ninjaClient.getActivities(getArg('pageSize'), getArg('after'), getArg('since'), getArg('type'));
        break;
      case 'ninjaone_get_device_activities':
        result = await ninjaClient.getDeviceActivities(getArg('deviceId'), getArg('pageSize'), getArg('after'), getArg('since'));
        break;
      case 'ninjaone_get_device_software':
        result = await ninjaClient.getDeviceSoftware(getArg('deviceId'));
        break;
      case 'ninjaone_get_org_software':
        result = await ninjaClient.getOrganizationSoftware(getArg('orgId'));
        break;
      case 'ninjaone_get_policies':
        result = await ninjaClient.getPolicies();
        break;
      case 'ninjaone_get_policy':
        result = await ninjaClient.getPolicy(getArg('id'));
        break;
      case 'ninjaone_get_locations':
        result = await ninjaClient.getLocations(getArg('pageSize'), getArg('after'));
        break;
      case 'ninjaone_get_location':
        result = await ninjaClient.getLocation(getArg('id'));
        break;
      case 'ninjaone_get_users':
        result = await ninjaClient.getUsers(getArg('pageSize'), getArg('after'));
        break;
      case 'ninjaone_get_device_roles':
        result = await ninjaClient.getDeviceRoles();
        break;
      case 'ninjaone_get_device_custom_fields':
        result = await ninjaClient.getDeviceCustomFields(getArg('deviceId'));
        break;
      case 'ninjaone_update_device_custom_fields':
        result = await ninjaClient.updateDeviceCustomFields(getArg('deviceId'), getArg('fields'));
        break;
      case 'ninjaone_get_jobs':
        result = await ninjaClient.getJobs(getArg('pageSize'), getArg('after'), getArg('status'));
        break;
      case 'ninjaone_get_job':
        result = await ninjaClient.getJob(getArg('id'));
        break;
      case 'ninjaone_get_tasks':
        result = await ninjaClient.getTasks(getArg('pageSize'), getArg('after'));
        break;
      case 'ninjaone_run_script':
        result = await ninjaClient.runScript(getArg('deviceId'), getArg('scriptId'), getArg('parameters'));
        break;
      case 'ninjaone_get_api_schema_overview':
        result = await ninjaClient.getApiSchemaOverview();
        break;
      case 'ninjaone_get_api_endpoint_details':
        result = await ninjaClient.getApiEndpointDetails(
          getArg('pathPattern'),
          getArg('summaryOnly', false),
          getArg('includeSchemas', true),
          getArg('maxEndpoints', 10),
          getArg('includeExamples', false)
        );
        break;
      case 'ninjaone_search_devices':
        result = await ninjaClient.searchDevices(
          getArg('hostname'), 
          getArg('status'), 
          getArg('os'), 
          getArg('organization'), 
          getArg('location'), 
          getArg('deviceType'),
          getArg('pageSize'), 
          getArg('after')
        );
        break;
      case 'ninjaone_api_call':
        result = await ninjaClient.makeApiCall(getArg('path'), getArg('method'), getArg('body'), getArg('queryParams'));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});