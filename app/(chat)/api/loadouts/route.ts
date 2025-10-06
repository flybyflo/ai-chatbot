import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createUserLoadout,
  deleteUserLoadout,
  getUserLoadouts,
  updateUserLoadout,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const createLoadoutSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  color: z.string().max(7).optional(),
  tags: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  selectedTools: z.array(z.string()).optional(),
});

const updateLoadoutSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().max(7).optional(),
  tags: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  selectedTools: z.array(z.string()).optional(),
});

const deleteLoadoutSchema = z.object({
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
    const loadouts = await getUserLoadouts(session.user.id);
    return NextResponse.json(loadouts);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch loadouts"
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
    const { name, description, color, tags, isDefault, selectedTools } =
      createLoadoutSchema.parse(body);
    const loadout = await createUserLoadout({
      userId: session.user.id,
      name,
      description,
      color,
      tags,
      isDefault,
      selectedTools,
    });
    return NextResponse.json(loadout, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to create loadout"
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
    const validated = updateLoadoutSchema.parse(body);
    const loadout = await updateUserLoadout({
      ...validated,
      userId: session.user.id,
    });
    if (!loadout) {
      return new ChatSDKError(
        "not_found:api",
        "Loadout not found"
      ).toResponse();
    }
    return NextResponse.json(loadout);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to update loadout"
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
    const { id } = deleteLoadoutSchema.parse(body);
    const success = await deleteUserLoadout({ id, userId: session.user.id });
    if (!success) {
      return new ChatSDKError(
        "not_found:api",
        "Loadout not found"
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
      "Failed to delete loadout"
    ).toResponse();
  }
}
