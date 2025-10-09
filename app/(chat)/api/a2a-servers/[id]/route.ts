import { fetchQuery } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = paramsSchema.parse(await context.params);
    const server = await fetchQuery(
      api.queries.getUserA2AServerById,
      { id: id as Id<"userA2AServers">, userId: session.user.id },
      { token }
    );
    if (!server) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }
    return NextResponse.json({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch A2A server"
    ).toResponse();
  }
}
