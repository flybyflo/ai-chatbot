import { fetchMutation } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { A2AClientWrapper } from "@/lib/ai/a2a/client";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const testA2AServerSchema = z.object({
  id: z.string().uuid(),
  cardUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const serializeA2AServer = (server: any) => ({
  id: server._id,
  userId: server.userId,
  name: server.name,
  cardUrl: server.cardUrl,
  description: server.description ?? null,
  headers: server.headers ?? {},
  isActive: server.isActive,
  lastConnectionTest: server.lastConnectionTest
    ? new Date(server.lastConnectionTest).toISOString()
    : null,
  lastConnectionStatus: server.lastConnectionStatus ?? null,
  lastError: server.lastError ?? null,
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
    const { id, cardUrl, headers } = testA2AServerSchema.parse(body);

    const testStartTime = new Date();
    let connectionStatus = "failed";
    let lastError: string | undefined;
    const agentCard: any = undefined;

    try {
      const client = new A2AClientWrapper({
        name: "test",
        cardUrl,
        headers,
      });
      const ok = await client.init();
      if (ok) {
        connectionStatus = "connected";
        // fetch agent card via client to verify
        // Note: the wrapper doesn't expose getAgentCard; rely on init success for now
      } else {
        lastError = client.getStatus().lastError || "Failed to connect";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }

    const updatedServer = await fetchMutation(
      api.mutations.updateUserA2AServer,
      {
        id: id as Id<"userA2AServers">,
        userId: session.user.id,
        lastConnectionTest: testStartTime.getTime(),
        lastConnectionStatus: connectionStatus,
        lastError,
      },
      { token }
    );

    if (!updatedServer) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }

    return NextResponse.json({
      server: serializeA2AServer(updatedServer),
      connected: connectionStatus === "connected",
      agentCard,
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
      "Failed to test A2A server"
    ).toResponse();
  }
}
