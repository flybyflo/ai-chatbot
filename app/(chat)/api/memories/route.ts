import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createUserMemory,
  deleteUserMemory,
  getUserMemories,
  updateUserMemory,
} from "@/lib/db/queries";
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

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const memories = await getUserMemories(session.user.id);
    return NextResponse.json(memories);
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
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { title, content } = createMemorySchema.parse(body);

    const memory = await createUserMemory({
      userId: session.user.id,
      title,
      content,
    });

    return NextResponse.json(memory, { status: 201 });
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
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { id, title, content, isActive } = updateMemorySchema.parse(body);

    const memory = await updateUserMemory({
      id,
      userId: session.user.id,
      title,
      content,
      isActive,
    });

    if (!memory) {
      return new ChatSDKError("not_found:api", "Memory not found").toResponse();
    }

    return NextResponse.json(memory);
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
    const session = await auth();

    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api", "Not authenticated").toResponse();
    }

    const body = await request.json();
    const { id } = deleteMemorySchema.parse(body);

    const success = await deleteUserMemory({
      id,
      userId: session.user.id,
    });

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
