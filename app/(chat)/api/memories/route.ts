import { fetchMutation, fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

const createMemorySchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(10_000),
});

const updateMemorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

const deleteMemorySchema = z.object({
  id: z.string().uuid(),
});

const serializeMemory = (memory: any) => ({
  id: memory._id,
  userId: memory.userId,
  title: memory.title,
  content: memory.content,
  isActive: memory.isActive,
  createdAt: new Date(memory.createdAt).toISOString(),
  updatedAt: new Date(memory.updatedAt).toISOString(),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

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

    const memories = await fetchQuery(
      api.queries.getUserMemories,
      { userId: session.user.id },
      { token }
    );
    return NextResponse.json(memories.map(serializeMemory));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch memories"
    ).toResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

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
    const { title, content } = createMemorySchema.parse(body);

    const memory = await fetchMutation(
      api.mutations.createUserMemory,
      {
        userId: session.user.id,
        title,
        content,
      },
      { token }
    );

    return NextResponse.json(serializeMemory(memory), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to create memory"
    ).toResponse();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

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
    const { id, title, content, isActive } = updateMemorySchema.parse(body);

    const memory = await fetchMutation(
      api.mutations.updateUserMemory,
      {
        id: id as Id<"userMemory">,
        userId: session.user.id,
        title,
        content,
        isActive,
      },
      { token }
    );

    if (!memory) {
      return new ChatSDKError("not_found:api", "Memory not found").toResponse();
    }

    return NextResponse.json(serializeMemory(memory));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to update memory"
    ).toResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

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
    const { id } = deleteMemorySchema.parse(body);

    const success = await fetchMutation(
      api.mutations.deleteUserMemory,
      {
        id: id as Id<"userMemory">,
        userId: session.user.id,
      },
      { token }
    );

    if (!success) {
      return new ChatSDKError("not_found:api", "Memory not found").toResponse();
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
      "Failed to delete memory"
    ).toResponse();
  }
}
