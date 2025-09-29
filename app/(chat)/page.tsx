import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
      />
    );
  }

  return (
    <Chat
      autoResume={false}
      id={id}
      initialChatModel={modelIdFromCookie.value}
      initialMessages={[]}
      initialVisibilityType="private"
      isReadonly={false}
      key={id}
    />
  );
}
