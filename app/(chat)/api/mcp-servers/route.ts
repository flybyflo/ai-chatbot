import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createUserMCPServer,
  deleteUserMCPServer,
  getUserMCPServers,
  updateUserMCPServer,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const createMCPServerSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
});

const updateMCPServerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
  lastConnectionTest: z.date().optional(),
  lastConnectionStatus: z.string().max(50).optional(),
  lastError: z.string().optional(),
  toolCount: z.number().int().min(0).optional(),
});

const deleteMCPServerSchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await getHeaders() });

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const mcpServers = await getUserMCPServers(session.user.id);
    return NextResponse.json(mcpServers);
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
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { name, url, description, headers } =
      createMCPServerSchema.parse(body);

    const mcpServer = await createUserMCPServer({
      userId: session.user.id,
      name,
      url,
      description,
      headers,
    });

    return NextResponse.json(mcpServer, { status: 201 });
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
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const validatedData = updateMCPServerSchema.parse(body);

    const mcpServer = await updateUserMCPServer({
      ...validatedData,
      userId: session.user.id,
    });

    if (!mcpServer) {
      return new ChatSDKError("not_found:api", "MCP server not found").toResponse();
    }

    return NextResponse.json(mcpServer);
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
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { id } = deleteMCPServerSchema.parse(body);

    const success = await deleteUserMCPServer({
      id,
      userId: session.user.id,
    });

    if (!success) {
      return new ChatSDKError("not_found:api", "MCP server not found").toResponse();
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
