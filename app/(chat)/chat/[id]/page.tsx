import { fetchQuery } from "convex/nextjs";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { api } from "@/convex/_generated/api";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { convertToUIMessages } from "@/lib/utils";
import type { AppUsage } from "@/lib/usage";

function normalizeLastContext(context: unknown): AppUsage | undefined {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  const usage = context as Record<string, unknown>;
  const promptTokens =
    typeof usage.promptTokens === "number"
      ? usage.promptTokens
      : typeof usage.inputTokens === "number"
        ? usage.inputTokens
        : undefined;
  const completionTokens =
    typeof usage.completionTokens === "number"
      ? usage.completionTokens
      : typeof usage.outputTokens === "number"
        ? usage.outputTokens
        : undefined;

  const inputTokens =
    typeof usage.inputTokens === "number"
      ? usage.inputTokens
      : promptTokens ?? 0;
  const outputTokens =
    typeof usage.outputTokens === "number"
      ? usage.outputTokens
      : completionTokens ?? 0;

  const totalTokens =
    typeof usage.totalTokens === "number"
      ? usage.totalTokens
      : (promptTokens ?? inputTokens) + (completionTokens ?? outputTokens);

  const normalized: AppUsage = {
    inputTokens,
    outputTokens,
    totalTokens,
  };

  if (typeof promptTokens === "number") {
    (normalized as Record<string, unknown>).promptTokens = promptTokens;
  }
  if (typeof completionTokens === "number") {
    (normalized as Record<string, unknown>).completionTokens =
      completionTokens;
  }
  if (typeof usage.modelId === "string") {
    normalized.modelId = usage.modelId;
  }
  if (typeof usage.reasoningTokens === "number") {
    (normalized as Record<string, unknown>).reasoningTokens =
      usage.reasoningTokens;
  }
  if (typeof usage.cachedTokens === "number") {
    (normalized as Record<string, unknown>).cachedTokens = usage.cachedTokens;
  }
  if (typeof usage.cacheReadTokens === "number") {
    (normalized as Record<string, unknown>).cacheReadTokens =
      usage.cacheReadTokens;
  }
  if (typeof usage.cacheWriteTokens === "number") {
    (normalized as Record<string, unknown>).cacheWriteTokens =
      usage.cacheWriteTokens;
  }
  if (typeof usage.inputUSD === "number") {
    (normalized as Record<string, unknown>).inputUSD = usage.inputUSD;
  }
  if (typeof usage.outputUSD === "number") {
    (normalized as Record<string, unknown>).outputUSD = usage.outputUSD;
  }
  if (typeof usage.totalUSD === "number") {
    (normalized as Record<string, unknown>).totalUSD = usage.totalUSD;
  }

  return normalized;
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const token = await getToken();
  const chat = await fetchQuery(
    api.queries.getChatById,
    { id },
    token ? { token } : undefined
  );

  if (!chat) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await fetchQuery(
    api.queries.getMessagesByChatId,
    { chatId: chat._id },
    token ? { token } : undefined
  );
  const formattedMessages = messagesFromDb.map((message) => ({
    id: message._id,
    chatId: message.chatId,
    role: message.role,
    parts: message.parts,
    attachments: message.attachments,
    createdAt: message.createdAt,
  }));

  const uiMessages = convertToUIMessages(formattedMessages);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <Chat
        autoResume={true}
        id={chat._id}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialLastContext={normalizeLastContext(chat.lastContext)}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
      />
    );
  }

  return (
    <Chat
      autoResume={true}
      id={chat._id}
      initialChatModel={chatModelFromCookie.value}
      initialLastContext={normalizeLastContext(chat.lastContext)}
      initialMessages={uiMessages}
      initialVisibilityType={chat.visibility}
      isReadonly={session?.user?.id !== chat.userId}
    />
  );
}
