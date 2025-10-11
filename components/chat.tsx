"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useAction, useQuery } from "convex/react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useAllTools } from "@/hooks/use-tools";
import { useSession } from "@/lib/auth-client";
import { TOOL_TYPES, type ToolType } from "@/lib/enums";
import { useSharedSelectedTools } from "@/lib/selected-tools";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, generateUUID, getTextFromMessage } from "@/lib/utils";
import { useChatContext } from "./chat-context";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { ContainerTextFlip } from "./ui/container-text-flip";
import type { VisibilityType } from "./visibility-selector";

function dedupeA2AToolParts(parts: unknown[]) {
  if (!Array.isArray(parts)) {
    return [] as unknown[];
  }

  const deduped: unknown[] = [];
  const seen = new Map<string, number>();

  const clonePart = (part: any) => {
    if (!part || typeof part !== "object") {
      return part;
    }
    const clone: Record<string, unknown> = { ...part };
    if (part.input && typeof part.input === "object") {
      clone.input = { ...part.input };
    }
    if (part.output && typeof part.output === "object") {
      clone.output = { ...part.output };
    }
    if (part.data && typeof part.data === "object") {
      clone.data = { ...part.data };
    }
    return clone;
  };

  for (const part of parts) {
    if (!part || typeof part !== "object") {
      deduped.push(part);
      continue;
    }

    const type = (part as { type?: unknown }).type;
    if (typeof type !== "string" || !type.startsWith("tool-a2a_")) {
      deduped.push(clonePart(part));
      continue;
    }

    const normalizedPart = clonePart(part) as Record<string, unknown>;
    const output = normalizedPart.output as Record<string, unknown> | undefined;

    const keySegments: string[] = [];
    const toolCallId = normalizedPart.toolCallId;
    if (typeof toolCallId === "string" && toolCallId.length > 0) {
      keySegments.push(`call:${toolCallId}`);
    }
    if (output) {
      const primaryTaskId = output.primaryTaskId;
      if (typeof primaryTaskId === "string" && primaryTaskId.length > 0) {
        keySegments.push(`task:${primaryTaskId}`);
      }
      const contextId = output.contextId;
      if (typeof contextId === "string" && contextId.length > 0) {
        keySegments.push(`ctx:${contextId}`);
      }
      const agentToolId = output.agentToolId;
      if (typeof agentToolId === "string" && agentToolId.length > 0) {
        keySegments.push(`tool:${agentToolId}`);
      }
    }
    const toolName = normalizedPart.toolName;
    if (typeof toolName === "string" && toolName.length > 0) {
      keySegments.push(`name:${toolName}`);
    }

    const key =
      keySegments.length > 0
        ? keySegments.join("|")
        : `${type}:${(normalizedPart.agentKey as string | undefined) ?? ""}:${
            deduped.length
          }`;

    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      const existing = deduped[existingIndex];
      if (existing && typeof existing === "object") {
        const existingRecord = existing as Record<string, unknown>;
        const merged: Record<string, unknown> = { ...existingRecord };

        for (const [field, value] of Object.entries(normalizedPart)) {
          if (value === undefined) {
            continue;
          }

          if (field === "output" || field === "input" || field === "data") {
            const existingValue = existingRecord[field];
            if (
              existingValue &&
              typeof existingValue === "object" &&
              value &&
              typeof value === "object"
            ) {
              merged[field] = {
                ...(existingValue as Record<string, unknown>),
                ...(value as Record<string, unknown>),
              };
              continue;
            }
          }

          merged[field] = value;
        }

        deduped[existingIndex] = merged;
      } else {
        deduped[existingIndex] = normalizedPart;
      }
      continue;
    }

    seen.set(key, deduped.length);
    deduped.push(normalizedPart);
  }

  return deduped;
}

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream, setChatId } = useDataStream();
  const { setCurrentMessages } = useChatContext();

  // Set chat ID and clear data stream when chat mounts to prevent carry-over between chats
  useEffect(() => {
    console.group(`[A2A-STREAM] Chat Component Mount - ID: ${id}`);
    console.log("Timestamp:", new Date().toISOString());
    console.log("Setting chatId in provider:", id);
    console.log("Clearing data stream for new chat session");
    console.groupEnd();
    setChatId(id);
    setDataStream([]);

    return () => {
      console.group(`[A2A-STREAM] Chat Component Unmount - ID: ${id}`);
      console.log("Timestamp:", new Date().toISOString());
      console.log("Cleaning up chat session");
      console.log("Clearing chatId from provider");
      console.groupEnd();
      setChatId(undefined);
    };
  }, [id, setDataStream, setChatId]);

  const [input, setInput] = useState<string>("");
  const [usage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const { tools: availableTools } = useAllTools();
  const toolTypeMap = useMemo(() => {
    const map = new Map<string, ToolType>();
    for (const tool of availableTools) {
      map.set(tool.id, tool.type as ToolType);
    }
    return map;
  }, [availableTools]);

  const resolveToolType = useCallback(
    (toolId: string) => toolTypeMap.get(toolId) ?? TOOL_TYPES.MCP,
    [toolTypeMap]
  );

  const {
    selectedTools,
    setSelectedTools: updateSelectedTools,
    updatePreferences,
    selectedChatModel: persistedChatModel,
    selectedReasoningEffort: persistedReasoningEffort,
    activeLoadoutId: persistedActiveLoadoutId,
  } = useSharedSelectedTools({
    defaultTools: ["getWeather"],
    resolveToolType,
  });

  const [currentModelId, setCurrentModelId] = useState(
    persistedChatModel ?? initialChatModel
  );
  const currentModelIdRef = useRef(currentModelId);
  const [currentReasoningEffort, setCurrentReasoningEffort] = useState<
    "low" | "medium" | "high"
  >(persistedReasoningEffort ?? "high");
  const [activeLoadoutId, setActiveLoadoutId] = useState<string | null>(
    persistedActiveLoadoutId ?? null
  );
  const selectedToolsRef = useRef(selectedTools);

  useEffect(() => {
    if (persistedChatModel && persistedChatModel !== currentModelId) {
      setCurrentModelId(persistedChatModel);
    }
  }, [persistedChatModel, currentModelId]);

  useEffect(() => {
    if (
      persistedReasoningEffort &&
      persistedReasoningEffort !== currentReasoningEffort
    ) {
      setCurrentReasoningEffort(persistedReasoningEffort);
    }
  }, [persistedReasoningEffort, currentReasoningEffort]);

  useEffect(() => {
    if (persistedActiveLoadoutId !== activeLoadoutId) {
      setActiveLoadoutId(persistedActiveLoadoutId ?? null);
    }
  }, [persistedActiveLoadoutId, activeLoadoutId]);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    selectedToolsRef.current = selectedTools;
  }, [selectedTools]);

  const handleModelChange = useCallback(
    (modelId: string) => {
      setCurrentModelId(modelId);
      updatePreferences({ selectedChatModel: modelId }).catch((error) => {
        console.error("[CHAT] Failed to persist model preference", error);
      });
    },
    [updatePreferences]
  );

  const handleReasoningEffortChange = useCallback(
    (effort: "low" | "medium" | "high") => {
      setCurrentReasoningEffort(effort);
      updatePreferences({ selectedReasoningEffort: effort }).catch((error) => {
        console.error(
          "[CHAT] Failed to persist reasoning effort preference",
          error
        );
      });
    },
    [updatePreferences]
  );

  const handleActiveLoadoutChange = useCallback(
    (nextId: string | null) => {
      setActiveLoadoutId(nextId);
      updatePreferences({ activeLoadoutId: nextId }).catch((error) => {
        console.error("[CHAT] Failed to persist active loadout", error);
      });
    },
    [updatePreferences]
  );

  // Get current user session
  const { data: session } = useSession();

  // Subscribe to real-time messages from Convex
  const messagesFromConvex = useQuery(api.queries.getMessagesByChatId, {
    chatId: id as Id<"chats">,
  });

  // Mutation to start a new message pair
  const startMessagePair = useAction(api.ai.startChatMessagePair);

  // Local state for optimistic UI updates
  const [localMessages, setLocalMessages] =
    useState<ChatMessage[]>(initialMessages);

  // Track previous A2A event count to only log on changes
  const prevA2ACountRef = useRef(0);

  // Convert Convex messages to UI format
  useEffect(() => {
    if (messagesFromConvex) {
      const nextDataStreamParts: any[] = [];
      let totalA2AParts = 0;

      const uiMessages: ChatMessage[] = messagesFromConvex.map((msg) => {
        const rawParts: any[] = Array.isArray(msg.parts)
          ? [...msg.parts]
          : msg.parts
            ? [msg.parts]
            : [];

        const normalizedParts = dedupeA2AToolParts(rawParts) as any[];
        let parts: any[] = [...normalizedParts];

        for (const part of normalizedParts) {
          const partType = (part as any)?.type;
          if (typeof partType !== "string") {
            continue;
          }

          if (partType.startsWith("tool-a2a_")) {
            totalA2AParts++;
            const output = (part as any)?.output;
            if (output && typeof output === "object") {
              nextDataStreamParts.push({
                type: "data-a2aEvents",
                data: output,
              });
            }
            continue;
          }

          if (partType.startsWith("data-")) {
            const dataPayload =
              (part as any)?.data ?? (part as any)?.output ?? part;
            nextDataStreamParts.push({
              type: partType,
              data: dataPayload,
            });
          }
        }

        const toolPartsForStream = normalizedParts.filter((part) => {
          const type = (part as any)?.type;
          return typeof type === "string" && type.startsWith("tool-a2a_");
        });

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

          if (toolPartsForStream.length > 0) {
            streamingParts.push(...toolPartsForStream);
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

        const normalized: ChatMessage & {
          experimental_isStreaming?: boolean;
        } = {
          id: msg._id,
          role: msg.role,
          parts: parts || [],
          attachments: msg.attachments || [],
          metadata: {
            createdAt: new Date(msg.createdAt).toISOString(),
          },
          experimental_isStreaming: !msg.isComplete,
        };

        return normalized;
      });

      // Only log when A2A event count changes
      if (totalA2AParts !== prevA2ACountRef.current) {
        console.group(`[A2A-STREAM] A2A Events Changed - Chat ID: ${id}`);
        console.log("Previous count:", prevA2ACountRef.current);
        console.log("New count:", totalA2AParts);
        console.log(
          "Events:",
          nextDataStreamParts
            .filter(
              (p) => p.type === "data-a2aEvents" || p.type === "data-a2a-events"
            )
            .map((p) => ({
              agentToolId: p.data?.agentToolId,
              contextId: p.data?.contextId,
              primaryTaskId: p.data?.primaryTaskId,
              timestamp: p.data?.timestamp,
            }))
        );
        console.groupEnd();
        prevA2ACountRef.current = totalA2AParts;
      }

      setLocalMessages(uiMessages);
      setDataStream(nextDataStreamParts);
    }
  }, [messagesFromConvex, id, setDataStream]);

  const messages = localMessages;
  const status: ChatStatus = messagesFromConvex?.some((m) => !m.isComplete)
    ? "streaming"
    : "ready";

  const [showHeroLayout, setShowHeroLayout] = useState(
    initialMessages.length === 0
  );
  const [hasHeroExited, setHasHeroExited] = useState(
    initialMessages.length > 0
  );

  useEffect(() => {
    if (messages.length === 0) {
      setShowHeroLayout(true);
      setHasHeroExited(false);
      return;
    }

    if (showHeroLayout) {
      setShowHeroLayout(false);
    }
  }, [messages.length, showHeroLayout]);

  const handleHeroExitComplete = useCallback(() => {
    setHasHeroExited(true);
  }, []);

  // Send message function
  const sendMessage = useCallback(
    async (message: ChatMessage) => {
      if (!session?.user) {
        toast.error("You must be logged in to send messages");
        return;
      }

      // Optimistically add user message to UI
      const userMessage: ChatMessage = {
        id: message.id || generateUUID(),
        role: "user",
        parts:
          message.parts && message.parts.length > 0
            ? message.parts
            : [{ type: "text", text: getTextFromMessage(message) || input }],
        attachments: message.attachments || [],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };

      const placeholderId = generateUUID();
      const assistantPlaceholder: ChatMessage & {
        experimental_isStreaming?: boolean;
      } = {
        id: placeholderId,
        role: "assistant",
        parts: [
          {
            type: "reasoning",
            text: "Reasoning...",
          },
        ],
        attachments: [],
        metadata: {
          createdAt: new Date().toISOString(),
        },
        experimental_isStreaming: true,
      };

      setLocalMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

      try {
        await startMessagePair({
          chatId: id,
          userMessage: {
            id: userMessage.id,
            role: userMessage.role,
            parts: userMessage.parts,
            attachments: userMessage.attachments,
          },
          userId: session.user.id,
          selectedChatModel: currentModelIdRef.current,
          selectedVisibilityType: visibilityType,
          selectedReasoningEffort: currentReasoningEffort,
          selectedTools: selectedToolsRef.current,
        });

        // Invalidate chat history
        mutate(unstable_serialize(getChatHistoryPaginationKey));
      } catch (error) {
        console.error("Failed to send message:", error);

        if (error instanceof Error) {
          if (
            error.message?.includes("AI Gateway requires a valid credit card")
          ) {
            setShowCreditCardAlert(true);
          } else {
            toast.error(error.message || "Failed to send message");
          }
        }

        // Remove optimistic message on error
        setLocalMessages((prev) =>
          prev.filter((m) => m.id !== userMessage.id && m.id !== placeholderId)
        );
      }
    },
    [
      session,
      id,
      startMessagePair,
      visibilityType,
      currentReasoningEffort,
      mutate,
      input,
    ]
  );

  const setMessages = useCallback(
    (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      if (typeof newMessages === "function") {
        setLocalMessages(newMessages);
      } else {
        setLocalMessages(newMessages);
      }
    },
    []
  );

  const stop = useCallback<UseChatHelpers<ChatMessage>["stop"]>(async () => {
    console.warn("Stop not yet implemented for Convex streaming");
    return await Promise.resolve();
  }, []);

  const regenerate = useCallback<
    UseChatHelpers<ChatMessage>["regenerate"]
  >(async () => {
    console.warn("Regenerate not yet implemented for Convex streaming");
    return await Promise.resolve();
  }, []);

  const resumeStream = useCallback<
    UseChatHelpers<ChatMessage>["resumeStream"]
  >(async () => {
    console.warn("Resume stream not yet implemented for Convex streaming");
    return await Promise.resolve();
  }, []);

  useEffect(() => {
    return () => {
      setDataStream([]);
    };
  }, [setDataStream]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        id: generateUUID(),
        role: "user" as const,
        parts: [{ type: "text", text: query }],
        metadata: { createdAt: new Date().toISOString() },
      }).catch((error) => {
        console.error("Failed to send message:", error);
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  // Update chat context with current messages
  useEffect(() => {
    setCurrentMessages(messages);
  }, [messages, setCurrentMessages]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <LayoutGroup>
        <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
          <ChatHeader
            chatId={id}
            isReadonly={isReadonly}
            selectedVisibilityType={initialVisibilityType}
          />

          <div className="relative flex flex-1 flex-col">
            <AnimatePresence
              initial={false}
              mode="wait"
              onExitComplete={handleHeroExitComplete}
            >
              {showHeroLayout ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-none absolute inset-x-0 top-[-4rem] z-10 flex h-full items-center justify-center px-2 md:px-4"
                  exit={{ opacity: 0, y: 160 }}
                  initial={{ opacity: 0, y: 120 }}
                  key="chat-hero"
                  transition={{
                    y: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.3, ease: "easeOut" },
                  }}
                >
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-4xl"
                    exit={{ opacity: 0, y: 80 }}
                    initial={{ opacity: 0, y: 40 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <h1 className="mb-8 text-center font-bold text-3xl text-foreground">
                      <ContainerTextFlip
                        words={["better", "modern", "awesome"]}
                      />
                    </h1>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex h-full flex-col">
              {hasHeroExited ? (
                <Messages
                  chatId={id}
                  isReadonly={isReadonly}
                  messages={messages}
                  regenerate={regenerate}
                  selectedModelId={initialChatModel}
                  setMessages={setMessages}
                  status={status}
                  votes={votes}
                />
              ) : (
                <div className="flex-1" />
              )}

              {!isReadonly && (
                <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
                  <motion.div
                    animate={
                      showHeroLayout
                        ? { opacity: 1, y: "-40vh" }
                        : { opacity: 1, y: 0 }
                    }
                    className="w-full"
                    initial={
                      showHeroLayout
                        ? { opacity: 0, y: "-46vh" }
                        : { opacity: 0, y: 24 }
                    }
                    transition={{
                      duration: 0.5,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <MultimodalInput
                      activeLoadoutId={activeLoadoutId}
                      attachments={attachments}
                      chatId={id}
                      input={input}
                      messages={messages}
                      onActiveLoadoutChange={handleActiveLoadoutChange}
                      onModelChange={handleModelChange}
                      onReasoningEffortChange={handleReasoningEffortChange}
                      onToolsChange={updateSelectedTools}
                      selectedModelId={currentModelId}
                      selectedReasoningEffort={currentReasoningEffort}
                      selectedTools={selectedTools}
                      selectedVisibilityType={visibilityType}
                      sendMessage={sendMessage}
                      setAttachments={setAttachments}
                      setInput={setInput}
                      setMessages={setMessages}
                      status={status}
                      stop={stop}
                      usage={usage}
                    />
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </div>
      </LayoutGroup>

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};
