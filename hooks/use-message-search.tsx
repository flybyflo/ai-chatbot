"use client";

import { useMemo, useState } from "react";
import type { Chat } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

export interface SearchResult {
  chatId: string;
  messageId: string;
  messageContent: string;
  chatTitle: string;
  createdAt: Date;
  messageIndex: number;
}

export function useMessageSearch(
  currentMessages: ChatMessage[] = [],
  chatHistory: Chat[] = []
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
    currentMessages.forEach((message, index) => {
      if (message.parts) {
        message.parts.forEach((part) => {
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
        });
      }
    });

    // Search in chat history titles
    const historyResults: SearchResult[] = chatHistory
      .filter((chat) => chat.title.toLowerCase().includes(query))
      .map((chat) => ({
        chatId: chat.id,
        messageId: "",
        messageContent: "",
        chatTitle: chat.title,
        createdAt: chat.createdAt,
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
