import { fetchMutation, fetchQuery } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const createA2AServerSchema = z.object({
  name: z.string().min(1).max(255),
  cardUrl: z.string().url(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
});

const updateA2AServerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  cardUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
  lastConnectionTest: z.date().optional(),
  lastConnectionStatus: z.string().max(50).optional(),
  lastError: z.string().optional(),
});

const deleteA2AServerSchema = z.object({
  id: z.string().uuid(),
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

export async function GET() {
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

    const a2aServers = await fetchQuery(
      api.queries.getUserA2AServers,
      { userId: session.user.id },
      { token }
    );
    return NextResponse.json(a2aServers.map(serializeA2AServer));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch A2A servers"
    ).toResponse();
  }
}

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
    const { name, cardUrl, description, headers } =
      createA2AServerSchema.parse(body);
    const a2a = await fetchMutation(
      api.mutations.createUserA2AServer,
      {
        userId: session.user.id,
        name,
        cardUrl,
        description,
        headers,
      },
      { token }
    );
    return NextResponse.json(serializeA2AServer(a2a), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to create A2A server"
    ).toResponse();
  }
}

export async function PUT(request: NextRequest) {
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
    const validated = updateA2AServerSchema.parse(body);
    const a2a = await fetchMutation(
      api.mutations.updateUserA2AServer,
      {
        ...validated,
        id: validated.id as Id<"userA2AServers">,
        userId: session.user.id,
      },
      { token }
    );
    if (!a2a) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }
    return NextResponse.json(serializeA2AServer(a2a));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to update A2A server"
    ).toResponse();
  }
}

export async function DELETE(request: NextRequest) {
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
    const { id } = deleteA2AServerSchema.parse(body);
    const success = await fetchMutation(
      api.mutations.deleteUserA2AServer,
      { id: id as Id<"userA2AServers">, userId: session.user.id },
      { token }
    );
    if (!success) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to delete A2A server"
    ).toResponse();
  }
}
