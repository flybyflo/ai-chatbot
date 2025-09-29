import { headers as getHeaders } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { A2AClientWrapper } from "@/lib/ai/a2a/client";
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

    const client = new A2AClientWrapper({
      id: server.id,
      name: server.name,
      cardUrl: server.cardUrl,
      headers: server.headers || undefined,
    });
    const ok = await client.init();
    if (!ok) {
      const err =
        client.getStatus().lastError || "Failed to initialize A2A client";
      return new ChatSDKError("offline:api", err).toResponse();
    }

    const card = await client.getAgentCard();
    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError("bad_request:api", "Invalid input").toResponse();
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "offline:api",
      "Failed to fetch AgentCard"
    ).toResponse();
  }
}
