"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { ChatMessage } from "@/lib/types";

type ChatContextType = {
  currentMessages: ChatMessage[];
  setCurrentMessages: (messages: ChatMessage[]) => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);

  return (
    <ChatContext.Provider value={{ currentMessages, setCurrentMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
