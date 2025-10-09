import { fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const token = await getToken();
  if (!token) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const response = await fetchQuery(
    api.queries.getChatsByUserId,
    {
      userId: session.user.id,
      limit,
      cursor: startingAfter ?? endingBefore ?? undefined,
      direction: endingBefore ? "backward" : "forward",
    },
    { token }
  );

  const normalizedChats = response.chats.map((chat) => ({
    id: chat._id,
    title: chat.title,
    userId: chat.userId,
    visibility: chat.visibility,
    createdAt: new Date(chat.createdAt).toISOString(),
    lastContext: chat.lastContext ?? null,
  }));

  return Response.json({ chats: normalizedChats, hasMore: response.hasMore });
}
