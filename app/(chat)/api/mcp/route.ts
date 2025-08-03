import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getMCPServersByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    // Get saved MCP servers from database
    const savedServers = await getMCPServersByUserId({ userId: session.user.id });
    const enabledServers = savedServers.filter(server => server.isEnabled);

    if (enabledServers.length === 0) {
      return NextResponse.json({
        servers: [],
        message: 'No enabled MCP servers configured'
      });
    }

    const servers = [];

    // Test each enabled server
    for (const server of enabledServers) {
      let mcpClient: Client | null = null;

      try {
        // Configure transport with optional authentication
        const transportConfig: any = {};

        // Add authentication headers if token is provided
        if (server.authToken) {
          transportConfig.requestInit = {
            headers: {
              Authorization: `Bearer ${server.authToken}`,
              'Content-Type': 'application/json',
            },
          };
        }

        const transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          Object.keys(transportConfig).length > 0
            ? transportConfig
            : undefined,
        );

        // Create official MCP client
        mcpClient = new Client(
          {
            name: 'ai-chatbot-status',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );

        // Connect to the server
        await mcpClient.connect(transport);

        // Get available tools from MCP server
        const toolsResult = await mcpClient.listTools();

        servers.push({
          name: server.name,
          url: server.url,
          status: 'connected',
          lastConnected: new Date().toISOString(),
          tools: toolsResult.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        });

        await mcpClient.close();

      } catch (error: any) {
        console.error(`Failed to connect to MCP server ${server.name}:`, error.message);
        
        // Check if this is a 401 authorization error
        let errorStatus = 'error';
        if (
          error.message?.includes('401') || 
          error.message?.includes('Unauthorized') || 
          error.message?.includes('unauthorized') ||
          error.message?.includes('HTTP 401') ||
          error.message?.includes('Authentication required') ||
          error.message?.includes('invalid_token')
        ) {
          errorStatus = 'auth_required';
        }
        
        servers.push({
          name: server.name,
          url: server.url,
          status: errorStatus,
          error: error.message,
          tools: []
        });

        if (mcpClient) {
          try {
            await mcpClient.close();
          } catch (closeError) {
            console.error('Error closing MCP client:', closeError);
          }
        }
      }
    }

    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Error fetching MCP servers:', error);
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}