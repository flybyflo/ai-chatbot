"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatMessage } from "@/lib/types";

/**
 * Hook to use Convex for real-time chat messages
 * Provides similar interface to useChat but with Convex backend
 */
export function useConvexChat({ chatId }: { chatId: string }) {
  // Subscribe to real-time messages
  const messagesFromConvex = useQuery(api.queries.getMessagesByChatId, {
    chatId: chatId as Id<"chats">,
  });

  // Mutation to start a new message pair
  const startMessagePair = useAction(api.ai.startChatMessagePair);

  // Convert Convex messages to UI format
  const messages: ChatMessage[] =
    messagesFromConvex?.map((msg, msgIndex) => {
      // For streaming messages, use combined chunks as temporary content
      let parts: any[] = Array.isArray(msg.parts)
        ? [...msg.parts]
        : msg.parts
          ? [msg.parts]
          : [];

      // Build parts from chunks during streaming
      if (!msg.isComplete) {
        const streamingParts: any[] = [];

        // Add reasoning part if available
        if (
          msg.reasoningChunks &&
          msg.reasoningChunks.length > 0 &&
          msg.combinedReasoning
        ) {
          streamingParts.push({
            type: "reasoning",
            text: msg.combinedReasoning,
          });
        } else if (msg.role === "assistant") {
          streamingParts.push({
            type: "reasoning",
            text: "Reasoning...",
          });
        }

        // Add text part if available
        if (msg.chunks && msg.chunks.length > 0 && msg.combinedContent) {
          streamingParts.push({
            type: "text",
            text: msg.combinedContent,
          });
        }

        if (streamingParts.length > 0) {
          parts = streamingParts;
        }
      } else if (
        msg.role === "assistant" &&
        msg.combinedReasoning &&
        (msg.reasoningChunks?.length ?? 0) > 0 &&
        !parts.some((part) => part?.type === "reasoning")
      ) {
        parts = [
          {
            type: "reasoning",
            text: msg.combinedReasoning,
          },
          ...parts,
        ];
      }

      const finalParts = parts || [];

      return {
        id: msg._id,
        role: msg.role,
        parts: finalParts,
        attachments: msg.attachments || [],
        createdAt: new Date(msg.createdAt),
        experimental_isStreaming: !msg.isComplete,
      };
    }) || [];

  // Check if any message is currently streaming
  const isStreaming = messagesFromConvex?.some((m) => !m.isComplete) ?? false;

  // Send a new message
  const append = useCallback(
    async (message: ChatMessage, options?: any) => {
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
      }
    },
    [chatId, startMessagePair]
  );

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
