import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { MCPClientWrapper } from "@/lib/ai/mcp/client";
import { updateUserMCPServer } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const testMCPServerSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
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
    const updatedServer = await updateUserMCPServer({
      id,
      userId: session.user.id,
      lastConnectionTest: testStartTime,
      lastConnectionStatus: connectionStatus,
      lastError,
      toolCount,
    });

    if (!updatedServer) {
      return new ChatSDKError("not_found:api", "MCP server not found").toResponse();
    }

    return NextResponse.json({
      server: updatedServer,
      tools,
      connected: connectionStatus === "connected",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to test MCP server"
    ).toResponse();
  }
}
