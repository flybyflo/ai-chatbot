"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatMessage } from "@/lib/types";

/**
 * Hook to use Convex for real-time chat messages
 * Provides similar interface to useChat but with Convex backend
 */
export function useConvexChat({ chatId }: { chatId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to real-time messages
  const messagesFromConvex = useQuery(api.queries.getMessagesByChatId, {
    chatId: chatId as Id<"chats">,
  });

  // Mutation to start a new message pair
  const startMessagePair = useAction(api.ai.startChatMessagePair);

  // Convert Convex messages to UI format
  const messages: ChatMessage[] =
    messagesFromConvex?.map((msg) => {
      // For streaming messages, use combined chunks as temporary content
      let parts = msg.parts;
      if (msg.chunks && msg.chunks.length > 0 && msg.combinedContent) {
        parts = [{ type: "text", text: msg.combinedContent }];
      }

      return {
        id: msg._id,
        role: msg.role,
        parts: parts || [],
        attachments: msg.attachments || [],
        createdAt: new Date(msg.createdAt),
        experimental_isStreaming: !msg.isComplete,
      };
    }) || [];

  // Check if any message is currently streaming
  const isStreaming =
    messagesFromConvex?.some((m) => !m.isComplete) || isLoading;

  // Send a new message
  const append = useCallback(
    async (message: ChatMessage, options?: any) => {
      setIsLoading(true);

      try {
        await startMessagePair({
          chatId,
          userMessage: {
            id: message.id,
            role: message.role,
            parts: message.parts,
            attachments: message.attachments || [],
          },
          userId: options?.userId || "",
          selectedChatModel: options?.selectedChatModel || "grok-2-latest",
          selectedVisibilityType: options?.selectedVisibilityType || "private",
          selectedReasoningEffort: options?.selectedReasoningEffort,
          selectedTools: options?.selectedTools,
          requestHints: options?.requestHints,
          title: options?.title,
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, startMessagePair]
  );

  // Log streaming status
  useEffect(() => {
    if (isStreaming) {
      const streamingMessages = messagesFromConvex?.filter(
        (m) => !m.isComplete
      );
      console.log(
        `📡 Streaming ${streamingMessages?.length || 0} message(s)...`
      );
    }
  }, [isStreaming, messagesFromConvex]);

  return {
    messages,
    isLoading: isStreaming,
    append,
    setMessages: () => {
      console.warn(
        "setMessages not supported with Convex - messages are read-only"
      );
    },
    reload: () => {
      console.warn("reload not yet implemented for Convex chat");
    },
    stop: () => {
      console.warn("stop not yet implemented for Convex chat");
    },
  };
}
