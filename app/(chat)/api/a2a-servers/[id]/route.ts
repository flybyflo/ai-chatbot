import { headers as getHeaders } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUserA2AServerById } from "@/lib/db/queries";
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

    const { id } = paramsSchema.parse(await context.params);
    const server = await getUserA2AServerById({ id, userId: session.user.id });
    if (!server) {
      return new ChatSDKError(
        "not_found:api",
        "A2A server not found"
      ).toResponse();
    }
    return NextResponse.json(server);
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
