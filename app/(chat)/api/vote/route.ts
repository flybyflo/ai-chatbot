import { fetchMutation, fetchQuery } from "convex/nextjs";
import { headers } from "next/headers";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  const token = await getToken();
  if (!token) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  const chat = await fetchQuery(
    api.queries.getChatById,
    { id: chatId as Id<"chats"> },
    { token }
  );

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:vote").toResponse();
  }

  const votes = await fetchQuery(
    api.queries.getVotesByChatId,
    { chatId: chat._id },
    { token }
  );

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: "up" | "down" } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required."
    ).toResponse();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  const token = await getToken();
  if (!token) {
    return new ChatSDKError("unauthorized:vote").toResponse();
  }

  const chat = await fetchQuery(
    api.queries.getChatById,
    { id: chatId as Id<"chats"> },
    { token }
  );

  if (!chat) {
    return new ChatSDKError("not_found:vote").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:vote").toResponse();
  }

  await fetchMutation(
    api.mutations.voteMessage,
    {
      chatId: chat._id,
      messageId: messageId as Id<"messages">,
      isUpvoted: type === "up",
    },
    { token }
  );

  return new Response("Message voted", { status: 200 });
}
