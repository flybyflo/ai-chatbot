import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { MCPClientWrapper } from "@/lib/ai/mcp/client";
import { getUserMCPServers } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const executeToolSchema = z.object({
  toolName: z.string(),
  arguments: z.record(z.any()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized", "Not authenticated").toResponse();
    }

    // Get the user's MCP servers and find the requested one
    const userServers = await getUserMCPServers(session.user.id);
    const server = userServers.find((s) => s.id === params.id);

    if (!server) {
      return new ChatSDKError("not_found", "MCP server not found").toResponse();
    }

    if (!server.isActive) {
      return new ChatSDKError(
        "bad_request",
        "MCP server is not active"
      ).toResponse();
    }

    try {
      // Create a client wrapper and connect
      const client = new MCPClientWrapper({
        name: server.name,
        url: server.url,
        headers: server.headers || {},
      });

      const connected = await client.connect();

      if (!connected) {
        return new ChatSDKError(
          "service_unavailable",
          "Failed to connect to MCP server"
        ).toResponse();
      }

      // Get tools
      const tools = await client.getTools();

      // Clean up the client
      await client.close();

      return NextResponse.json({
        serverId: server.id,
        serverName: server.name,
        tools,
      });
    } catch (error) {
      return new ChatSDKError(
        "service_unavailable",
        error instanceof Error ? error.message : "Failed to fetch tools"
      ).toResponse();
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "internal_server_error",
      "Failed to fetch server tools"
    ).toResponse();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { toolName, arguments: toolArgs } = executeToolSchema.parse(body);

    // Get the user's MCP servers and find the requested one
    const userServers = await getUserMCPServers(session.user.id);
    const server = userServers.find((s) => s.id === params.id);

    if (!server) {
      return new ChatSDKError("not_found", "MCP server not found").toResponse();
    }

    if (!server.isActive) {
      return new ChatSDKError(
        "bad_request",
        "MCP server is not active"
      ).toResponse();
    }

    try {
      // Create a client wrapper and connect
      const client = new MCPClientWrapper({
        name: server.name,
        url: server.url,
        headers: server.headers || {},
      });

      const connected = await client.connect();

      if (!connected) {
        return new ChatSDKError(
          "service_unavailable",
          "Failed to connect to MCP server"
        ).toResponse();
      }

      // Get tools and check if the requested tool exists
      const tools = await client.getTools();
      const tool = tools[toolName];

      if (!tool) {
        await client.close();
        return new ChatSDKError("not_found", "Tool not found").toResponse();
      }

      // Execute the tool (this will depend on the AI SDK implementation)
      // For now, we'll return the tool info and arguments
      const result = {
        serverId: server.id,
        serverName: server.name,
        toolName,
        arguments: toolArgs,
        tool,
        // TODO: Add actual tool execution when AI SDK supports it
        executed: false,
        message: "Tool execution not yet implemented",
      };

      // Clean up the client
      await client.close();

      return NextResponse.json(result);
    } catch (error) {
      return new ChatSDKError(
        "service_unavailable",
        error instanceof Error ? error.message : "Failed to execute tool"
      ).toResponse();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "internal_server_error",
      "Failed to execute tool"
    ).toResponse();
  }
}
