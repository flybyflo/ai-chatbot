"use client";

import { useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/types";

type HistoryChat = {
  id: string;
  title: string;
  createdAt: string;
};

export type SearchResult = {
  chatId: string;
  messageId: string;
  messageContent: string;
  chatTitle: string;
  createdAt: Date;
  messageIndex: number;
};

export function useMessageSearch(
  currentMessages: ChatMessage[] = [],
  chatHistory: HistoryChat[] = []
) {
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return {
        currentChatResults: [],
        historyResults: [],
      };
    }

    const query = searchQuery.toLowerCase();

    // Search in current chat messages
    const currentChatResults: SearchResult[] = [];
    for (const [index, message] of currentMessages.entries()) {
      if (message.parts) {
        for (const part of message.parts) {
          if (part.type === "text" && part.text) {
            const text = part.text.toLowerCase();
            if (text.includes(query)) {
              currentChatResults.push({
                chatId: "current",
                messageId: message.id,
                messageContent: part.text,
                chatTitle: "Current Chat",
                createdAt: new Date(),
                messageIndex: index,
              });
            }
          }
        }
      }
    }

    // Search in chat history titles
    const historyResults: SearchResult[] = chatHistory
      .filter((chat) => chat.title.toLowerCase().includes(query))
      .map((chat) => ({
        chatId: chat.id,
        messageId: "",
        messageContent: "",
        chatTitle: chat.title,
        createdAt: new Date(chat.createdAt),
        messageIndex: -1,
      }));

    return {
      currentChatResults,
      historyResults,
    };
  }, [searchQuery, currentMessages, chatHistory]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    hasResults:
      searchResults.currentChatResults.length > 0 ||
      searchResults.historyResults.length > 0,
  };
}
