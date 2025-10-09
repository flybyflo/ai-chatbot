import { fetchMutation, fetchQuery } from "convex/nextjs";
import { headers as getHeaders } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
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

const serializeLoadout = (loadout: any) => ({
  id: loadout._id,
  userId: loadout.userId,
  name: loadout.name,
  description: loadout.description ?? null,
  color: loadout.color ?? null,
  tags: loadout.tags ?? [],
  isDefault: loadout.isDefault,
  selectedTools: loadout.selectedTools ?? [],
  createdAt: new Date(loadout.createdAt).toISOString(),
  updatedAt: new Date(loadout.updatedAt).toISOString(),
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

    const loadouts = await fetchQuery(
      api.queries.getUserLoadouts,
      { userId: session.user.id },
      { token }
    );
    return NextResponse.json(loadouts.map(serializeLoadout));
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
    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const body = await request.json();
    const { name, description, color, tags, isDefault, selectedTools } =
      createLoadoutSchema.parse(body);
    const loadout = await fetchMutation(
      api.mutations.createUserLoadout,
      {
        userId: session.user.id,
        name,
        description,
        color,
        tags,
        isDefault,
        selectedTools,
      },
      { token }
    );
    return NextResponse.json(serializeLoadout(loadout), { status: 201 });
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
    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const body = await request.json();
    const validated = updateLoadoutSchema.parse(body);
    const loadout = await fetchMutation(
      api.mutations.updateUserLoadout,
      {
        ...validated,
        id: validated.id as Id<"userLoadouts">,
        userId: session.user.id,
      },
      { token }
    );
    if (!loadout) {
      return new ChatSDKError(
        "not_found:api",
        "Loadout not found"
      ).toResponse();
    }
    return NextResponse.json(serializeLoadout(loadout));
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
    const token = await getToken();
    if (!token) {
      return new ChatSDKError(
        "unauthorized:api",
        "Not authenticated"
      ).toResponse();
    }

    const body = await request.json();
    const { id } = deleteLoadoutSchema.parse(body);
    const success = await fetchMutation(
      api.mutations.deleteUserLoadout,
      { id: id as Id<"userLoadouts">, userId: session.user.id },
      { token }
    );
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
