import { fetchMutation } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MCPClientWrapper } from "@/lib/ai/mcp/client";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const testMCPServerSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const serializeMCPServer = (server: any) => ({
  id: server._id,
  userId: server.userId,
  name: server.name,
  url: server.url,
  description: server.description ?? null,
  headers: server.headers ?? {},
  isActive: server.isActive,
  lastConnectionTest: server.lastConnectionTest
    ? new Date(server.lastConnectionTest).toISOString()
    : null,
  lastConnectionStatus: server.lastConnectionStatus ?? null,
  lastError: server.lastError ?? null,
  toolCount: server.toolCount ?? 0,
  createdAt: new Date(server.createdAt).toISOString(),
  updatedAt: new Date(server.updatedAt).toISOString(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await getHeaders() });

    if (!session?.user?.id) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const body = await request.json();
    const { id, url, headers } = testMCPServerSchema.parse(body);

    const testStartTime = new Date();
    let connectionStatus = "failed";
    let lastError: string | undefined;
    let toolCount = 0;
    let tools: Record<string, any> = {};

    try {
      // Create a test client wrapper
      const client = new MCPClientWrapper({
        name: "test",
        url,
        headers,
      });

      // Attempt to connect
      const connected = await client.connect();

      if (connected) {
        connectionStatus = "connected";
        // Try to get tools
        tools = await client.getTools();
        toolCount = Object.keys(tools).length;
      } else {
        const status = client.getStatus();
        lastError = status.lastError || "Failed to connect";
      }

      // Clean up the client
      await client.close();
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }

    // Update the server with connection test results
    const updatedServer = await fetchMutation(
      api.mutations.updateUserMCPServer,
      {
        id: id as Id<"userMCPServers">,
        userId: session.user.id,
        lastConnectionTest: testStartTime.getTime(),
        lastConnectionStatus: connectionStatus,
        lastError,
        toolCount,
      },
      { token }
    );

    if (!updatedServer) {
      return new ChatSDKError(
        "not_found:api",
        "MCP server not found"
      ).toResponse();
    }

    return NextResponse.json({
      server: serializeMCPServer(updatedServer),
      tools,
      connected: connectionStatus === "connected",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      console.error("Validation error:", errorDetails);
      return new ChatSDKError(
        "bad_request:api",
        `Invalid input: ${errorDetails}`
      ).toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("MCP server test error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new ChatSDKError(
      "offline:api",
      `Failed to test MCP server: ${errorMessage}`
    ).toResponse();
  }
}
