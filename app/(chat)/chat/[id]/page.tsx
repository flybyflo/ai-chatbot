import { fetchQuery } from "convex/nextjs";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { api } from "@/convex/_generated/api";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/auth-server";
import { convertToUIMessages } from "@/lib/utils";

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
        initialLastContext={chat.lastContext ?? undefined}
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
      initialLastContext={chat.lastContext ?? undefined}
      initialMessages={uiMessages}
      initialVisibilityType={chat.visibility}
      isReadonly={session?.user?.id !== chat.userId}
    />
  );
}
