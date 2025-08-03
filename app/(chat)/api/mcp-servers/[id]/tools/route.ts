import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getMCPServersByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    const { id } = await params;

    // Get the specific server for this user
    const servers = await getMCPServersByUserId({ userId: session.user.id });
    const server = servers.find(s => s.id === id);

    if (!server) {
      return new ChatSDKError('not_found:mcp_server').toResponse();
    }

    if (!server.isEnabled) {
      return NextResponse.json({ 
        status: 'disabled',
        tools: [],
        message: 'Server is disabled'
      });
    }

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
          name: 'ai-chatbot-tools',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      // Connect to the server with timeout
      const connectPromise = mcpClient.connect(transport);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Get available tools from MCP server
      const toolsResult = await mcpClient.listTools();

      await mcpClient.close();

      return NextResponse.json({
        status: 'connected',
        tools: toolsResult.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        })),
        lastChecked: new Date().toISOString()
      });

    } catch (error: any) {
      console.error(`Failed to connect to MCP server ${server.name}:`, error.message);
      
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.error('Error closing MCP client:', closeError);
        }
      }

      // Check if this is a 401 authorization error
      let errorType = 'error';
      if (
        error.message?.includes('401') || 
        error.message?.includes('Unauthorized') || 
        error.message?.includes('unauthorized') ||
        error.message?.includes('HTTP 401') ||
        error.message?.includes('Authentication required') ||
        error.message?.includes('invalid_token')
      ) {
        errorType = 'auth_required';
      }

      return NextResponse.json({
        status: errorType,
        tools: [],
        error: error.message,
        lastChecked: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error fetching MCP server tools:', error);
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}