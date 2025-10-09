"use server";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getToken } from "@/lib/auth-server";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const token = await getToken();
  if (!token) {
    throw new Error("Unable to authenticate request");
  }

  const message = await fetchQuery(
    api.queries.getMessageById,
    { id: id as Id<"messages"> },
    { token }
  );

  if (!message) {
    return;
  }

  await fetchMutation(
    api.mutations.deleteMessagesByChatIdAfterTimestamp,
    {
      chatId: message.chatId,
      timestamp: message.createdAt,
    },
    { token }
  );
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const token = await getToken();
  if (!token) {
    throw new Error("Unable to authenticate request");
  }

  await fetchMutation(
    api.mutations.updateChatVisibility,
    {
      chatId: chatId as Id<"chats">,
      visibility,
    },
    { token }
  );
}
