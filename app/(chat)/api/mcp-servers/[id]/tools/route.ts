import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MCPClientWrapper } from "@/lib/ai/mcp/client";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const executeToolSchema = z.object({
  toolName: z.string(),
  arguments: z.record(z.any()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const { id } = await params;

    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    // Get the user's MCP servers and find the requested one
    const userServers = await fetchQuery(
      api.queries.getUserMCPServers,
      { userId: session.user.id },
      { token }
    );
    const server = userServers.find(
      (s) => s._id === (id as Id<"userMCPServers">)
    );

    if (!server) {
      return new ChatSDKError(
        "not_found:api",
        "MCP server not found"
      ).toResponse();
    }

    if (!server.isActive) {
      return new ChatSDKError(
        "bad_request:api",
        "MCP server is not active"
      ).toResponse();
    }

    try {
      // Create a client wrapper and connect
      const client = new MCPClientWrapper({
        name: server.name,
        url: server.url,
        headers: server.headers ?? {},
      });

      const connected = await client.connect();

      if (!connected) {
        return new ChatSDKError(
          "offline:api",
          "Failed to connect to MCP server"
        ).toResponse();
      }

      // Get tools
      const tools = await client.getTools();

      // Clean up the client
      await client.close();

      return NextResponse.json({
        serverId: server._id,
        serverName: server.name,
        tools,
      });
    } catch (error) {
      return new ChatSDKError(
        "offline:api",
        error instanceof Error ? error.message : "Failed to fetch tools"
      ).toResponse();
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch server tools"
    ).toResponse();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const body = await request.json();
    const { toolName, arguments: toolArgs } = executeToolSchema.parse(body);

    const { id } = await params;

    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    // Get the user's MCP servers and find the requested one
    const userServers = await fetchQuery(
      api.queries.getUserMCPServers,
      { userId: session.user.id },
      { token }
    );
    const server = userServers.find(
      (s) => s._id === (id as Id<"userMCPServers">)
    );

    if (!server) {
      return new ChatSDKError(
        "not_found:api",
        "MCP server not found"
      ).toResponse();
    }

    if (!server.isActive) {
      return new ChatSDKError(
        "bad_request:api",
        "MCP server is not active"
      ).toResponse();
    }

    try {
      // Create a client wrapper and connect
      const client = new MCPClientWrapper({
        name: server.name,
        url: server.url,
        headers: server.headers ?? {},
      });

      const connected = await client.connect();

      if (!connected) {
        return new ChatSDKError(
          "offline:api",
          "Failed to connect to MCP server"
        ).toResponse();
      }

      // Get tools and check if the requested tool exists
      const tools = await client.getTools();
      const tool = tools[toolName];

      if (!tool) {
        await client.close();
        return new ChatSDKError("not_found:api", "Tool not found").toResponse();
      }

      // Execute the tool (this will depend on the AI SDK implementation)
      // For now, we'll return the tool info and arguments
      const result = {
        serverId: server._id,
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
        "offline:api",
        error instanceof Error ? error.message : "Failed to execute tool"
      ).toResponse();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to execute tool"
    ).toResponse();
  }
}
