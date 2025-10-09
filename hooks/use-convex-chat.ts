"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect } from "react";
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
  console.log("🔎 [useConvexChat] Converting messages:", {
    hasMessages: !!messagesFromConvex,
    messageCount: messagesFromConvex?.length || 0,
  });

  const messages: ChatMessage[] =
    messagesFromConvex?.map((msg, msgIndex) => {
      console.log(`🔍 [useConvexChat] Message ${msgIndex}:`, {
        id: msg._id,
        role: msg.role,
        isComplete: msg.isComplete,
        hasReasoningChunks: !!msg.reasoningChunks,
        reasoningChunksLength: msg.reasoningChunks?.length || 0,
        combinedReasoningLength: msg.combinedReasoning?.length || 0,
        hasTextChunks: !!msg.chunks,
        textChunksLength: msg.chunks?.length || 0,
        combinedContentLength: msg.combinedContent?.length || 0,
        partsLength: msg.parts?.length || 0,
      });

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
          console.log(
            `🧠 [useConvexChat] Adding reasoning part: ${msg.combinedReasoning.length} chars`
          );
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
          console.log(
            `📝 [useConvexChat] Adding text part: ${msg.combinedContent.length} chars`
          );
          streamingParts.push({
            type: "text",
            text: msg.combinedContent,
          });
        }

        if (streamingParts.length > 0) {
          console.log(
            `✅ [useConvexChat] Built ${streamingParts.length} streaming parts`
          );
          parts = streamingParts;
        } else {
          console.log("⚠️ [useConvexChat] No streaming parts built");
        }
      } else if (
        msg.role === "assistant" &&
        msg.combinedReasoning &&
        (msg.reasoningChunks?.length ?? 0) > 0 &&
        !parts.some((part) => part?.type === "reasoning")
      ) {
        console.log(
          `🧠 [useConvexChat] Injecting combined reasoning fallback (${msg.combinedReasoning.length} chars)`
        );
        parts = [
          {
            type: "reasoning",
            text: msg.combinedReasoning,
          },
          ...parts,
        ];
      }

      const finalParts = parts || [];
      console.log(`📦 [useConvexChat] Final parts for message ${msgIndex}:`, {
        partsCount: finalParts.length,
        partTypes: finalParts.map((p: any) => p.type),
      });

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
