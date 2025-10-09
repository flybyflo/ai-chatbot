"use server";

import { generateText, type UIMessage } from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { myProvider } from "@/lib/ai/providers";
import { getToken } from "@/lib/auth-server";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
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
