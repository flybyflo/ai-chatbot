import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createUserA2AServer,
  deleteUserA2AServer,
  getUserA2AServers,
  updateUserA2AServer,
} from "@/lib/db/queries";
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

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await getHeaders() });
    if (!session?.user?.id) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }
    const a2aServers = await getUserA2AServers(session.user.id);
    return NextResponse.json(a2aServers);
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
    const body = await request.json();
    const { name, cardUrl, description, headers } =
      createA2AServerSchema.parse(body);
    const a2a = await createUserA2AServer({
      userId: session.user.id,
      name,
      cardUrl,
      description,
      headers,
    });
    return NextResponse.json(a2a, { status: 201 });
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
    const body = await request.json();
    const validated = updateA2AServerSchema.parse(body);
    const a2a = await updateUserA2AServer({
      ...validated,
      userId: session.user.id,
    });
    if (!a2a) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }
    return NextResponse.json(a2a);
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
    const body = await request.json();
    const { id } = deleteA2AServerSchema.parse(body);
    const success = await deleteUserA2AServer({ id, userId: session.user.id });
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
