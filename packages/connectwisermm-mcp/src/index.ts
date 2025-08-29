#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConnectWiseRMMClient } from './client.js';
import { createTools } from './tools.js';

const CLIENT_ID = process.env.CONNECTWISE_CLIENT_ID;
const CLIENT_SECRET = process.env.CONNECTWISE_CLIENT_SECRET;
const BASE_URL = process.env.CONNECTWISE_BASE_URL || 'https://openapi.service.auplatform.connectwise.com';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables: CONNECTWISE_CLIENT_ID and CONNECTWISE_CLIENT_SECRET');
  process.exit(1);
}

const client = new ConnectWiseRMMClient(CLIENT_ID, CLIENT_SECRET, BASE_URL);
const server = new Server(
  {
    name: 'connectwise-rmm-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: createTools(client),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'connectwise_get_schema_overview':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(client.getSchemaOverview(), null, 2)
          }]
        };

      case 'connectwise_get_endpoint_details':
        const details = client.getEndpointDetails(
          args?.pathPattern as string,
          {
            includeSchemas: args?.includeSchemas as boolean,
            includeExamples: args?.includeExamples as boolean,
            summaryOnly: args?.summaryOnly as boolean,
            maxEndpoints: Math.min((args?.maxEndpoints as number) || 10, 50)
          }
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(details, null, 2)
          }]
        };

      case 'connectwise_search_endpoints':
        const results = client.searchEndpoints(args?.query as string);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ results, count: results.length }, null, 2)
          }]
        };

      case 'connectwise_api_call':
        const response = await client.makeRequest(
          args?.method as string,
          args?.path as string,
          args?.body,
          args?.queryParams as Record<string, any>
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }]
        };

      case 'connectwise_get_companies':
        const companies = await client.makeRequest('GET', '/api/platform/v1/company/companies');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(companies, null, 2)
          }]
        };

      case 'connectwise_get_company':
        const company = await client.makeRequest(
          'GET',
          `/api/platform/v1/company/companies/${args?.companyId}`
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(company, null, 2)
          }]
        };

      case 'connectwise_get_sites':
        const sitesPath = args?.companyId 
          ? `/api/platform/v1/company/companies/${args.companyId}/sites`
          : '/api/platform/v1/company/sites';
        const sites = await client.makeRequest('GET', sitesPath);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(sites, null, 2)
          }]
        };

      case 'connectwise_get_devices':
        let devicePath = '/api/platform/v1/device/endpoints';
        if (args?.clientId && args?.siteId) {
          devicePath = `/api/platform/v1/device/clients/${args.clientId}/sites/${args.siteId}/endpoints`;
        } else if (args?.clientId) {
          devicePath = `/api/platform/v1/device/clients/${args.clientId}/endpoints`;
        }
        const devices = await client.makeRequest('GET', devicePath);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(devices, null, 2)
          }]
        };

      case 'connectwise_get_device':
        const device = await client.makeRequest(
          'GET',
          `/api/platform/v1/device/endpoints/${args?.endpointId}`
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(device, null, 2)
          }]
        };

      case 'connectwise_get_tickets':
        const ticketParams: Record<string, any> = {};
        if (args?.pageSize) ticketParams.pageSize = args.pageSize;
        if (args?.pageNum) ticketParams.pageNum = args.pageNum;
        if (args?.companyIds) ticketParams.companyIds = args.companyIds;
        if (args?.statusNames) ticketParams.statusNames = args.statusNames;
        if (args?.priorityNames) ticketParams.priorityNames = args.priorityNames;
        if (args?.summary) ticketParams.summary = args.summary;

        const tickets = await client.makeRequest(
          'GET',
          '/api/platform/v1/service/ticketing/tickets',
          null,
          ticketParams
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(tickets, null, 2)
          }]
        };

      case 'connectwise_get_ticket':
        const ticket = await client.makeRequest(
          'GET',
          `/api/platform/v1/service/ticketing/tickets/${args?.ticketId}`
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(ticket, null, 2)
          }]
        };

      case 'connectwise_create_ticket':
        const newTicket = await client.makeRequest(
          'POST',
          '/api/platform/v1/service/ticketing/tickets',
          {
            summary: args?.summary,
            detail: args?.detail,
            companyId: args?.companyId,
            siteId: args?.siteId,
            priorityId: args?.priorityId,
            statusId: args?.statusId
          }
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(newTicket, null, 2)
          }]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ConnectWise RMM MCP server running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});