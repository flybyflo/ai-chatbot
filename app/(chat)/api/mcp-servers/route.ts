import { fetchMutation, fetchQuery } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const authModeSchema = z.enum(["convex", "manual"]);

const createMCPServerSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
  authMode: authModeSchema.default("convex"),
  accessToken: z.string().optional(),
});

const updateMCPServerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
  authMode: authModeSchema.optional(),
  accessToken: z.string().optional(),
  isActive: z.boolean().optional(),
  lastConnectionTest: z.date().optional(),
  lastConnectionStatus: z.string().max(50).optional(),
  lastError: z.string().optional(),
  toolCount: z.number().int().min(0).optional(),
});

const deleteMCPServerSchema = z.object({
  id: z.string().uuid(),
});

const serializeMCPServer = (server: any) => ({
  id: server._id,
  userId: server.userId,
  name: server.name,
  url: server.url,
  description: server.description ?? null,
  headers: server.headers ?? {},
  authMode: server.authMode ?? "convex",
  accessToken: server.accessToken ?? null,
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

    const mcpServers = await fetchQuery(
      api.queries.getUserMCPServers,
      { userId: session.user.id },
      { token }
    );
    return NextResponse.json(mcpServers.map(serializeMCPServer));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch MCP servers"
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
    const { name, url, description, headers, authMode, accessToken } =
      createMCPServerSchema.parse(body);

    const accessTokenValue = authMode === "convex" ? undefined : accessToken;

    const mcpServer = await fetchMutation(
      api.mutations.createUserMCPServer,
      {
        userId: session.user.id,
        name,
        url,
        description,
        headers,
        authMode,
        accessToken: accessTokenValue,
      },
      { token }
    );

    return NextResponse.json(serializeMCPServer(mcpServer), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to create MCP server"
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
    const validatedData = updateMCPServerSchema.parse(body);
    const accessTokenValue =
      validatedData.authMode === "convex"
        ? undefined
        : validatedData.accessToken;

    const mcpServer = await fetchMutation(
      api.mutations.updateUserMCPServer,
      {
        ...validatedData,
        accessToken: accessTokenValue,
        lastConnectionTest: validatedData.lastConnectionTest?.getTime(),
        id: validatedData.id as Id<"userMCPServers">,
        userId: session.user.id,
      },
      { token }
    );

    if (!mcpServer) {
      return new ChatSDKError(
        "not_found:api",
        "MCP server not found"
      ).toResponse();
    }

    return NextResponse.json(serializeMCPServer(mcpServer));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to update MCP server"
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
    const { id } = deleteMCPServerSchema.parse(body);

    const success = await fetchMutation(
      api.mutations.deleteUserMCPServer,
      {
        id: id as Id<"userMCPServers">,
        userId: session.user.id,
      },
      { token }
    );

    if (!success) {
      return new ChatSDKError(
        "not_found:api",
        "MCP server not found"
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
      "Failed to delete MCP server"
    ).toResponse();
  }
}
