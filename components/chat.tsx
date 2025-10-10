"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useAction, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSession } from "@/lib/auth-client";
import { selectedToolsSchema } from "@/lib/schemas/tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, generateUUID, getTextFromMessage } from "@/lib/utils";
import { useChatContext } from "./chat-context";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import type { VisibilityType } from "./visibility-selector";

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
  const { setDataStream } = useDataStream();
  const { setCurrentMessages } = useChatContext();

  // Extract A2A events from initial messages and populate data stream
  useEffect(() => {
    const a2aEvents: any[] = [];

    for (const message of initialMessages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          const partType = (part as any).type;
          // Check if this is an A2A tool part
          if (
            typeof partType === "string" &&
            partType.startsWith("tool-a2a_")
          ) {
            const output = (part as any).output;
            if (output && typeof output === "object") {
              a2aEvents.push({
                type: "data-a2aEvents",
                data: output,
              });
            }
          }
        }
      }
    }

    setDataStream(a2aEvents);
  }, [initialMessages, setDataStream]);

  const [input, setInput] = useState<string>("");
  const [usage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentReasoningEffort, setCurrentReasoningEffort] = useState<
    "low" | "medium" | "high"
  >("high");
  const [selectedTools, setSelectedTools] = useState<string[]>(["getWeather"]);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const selectedToolsRef = useRef(selectedTools);
  const setStoreSelected = useMCPServerStore((s) => s.setSelectedTools);

  useEffect(() => {
    const stored = localStorage.getItem("reasoning-effort");
    if (stored === "low" || stored === "medium" || stored === "high") {
      setCurrentReasoningEffort(stored);
    }

    // Prefer React Query cache for selected tools across app
    // Prefer persisted Zustand store first
    const fromStore = useMCPServerStore.getState().selectedTools;
    if (fromStore && fromStore.length > 0) {
      setSelectedTools(fromStore);
      setHasLoadedFromStorage(true);
      return;
    }
    const storedTools = localStorage.getItem("selected-tools");
    if (storedTools) {
      try {
        const parsedTools = JSON.parse(storedTools);
        if (Array.isArray(parsedTools) && parsedTools.length > 0) {
          const validated = selectedToolsSchema.parse(parsedTools);
          setSelectedTools(validated);
        }
      } catch {
        localStorage.removeItem("selected-tools");
      }
    }
    setHasLoadedFromStorage(true);
  }, []);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    selectedToolsRef.current = selectedTools;
    // Only save to localStorage after we've loaded from storage initially
    if (hasLoadedFromStorage) {
      localStorage.setItem("selected-tools", JSON.stringify(selectedTools));
      // Update shared cache as source of truth
      try {
        const validated = selectedToolsSchema.parse(selectedTools);
        setStoreSelected(validated);
      } catch {
        // ignore validation errors
      }
    }
  }, [selectedTools, hasLoadedFromStorage, setStoreSelected]);

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

  // Convert Convex messages to UI format
  useEffect(() => {
    if (messagesFromConvex) {
      const uiMessages: ChatMessage[] = messagesFromConvex.map((msg) => {
        // For streaming messages, build parts from chunks
        let parts: any[] = Array.isArray(msg.parts)
          ? [...msg.parts]
          : msg.parts
            ? [msg.parts]
            : [];

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

      setLocalMessages(uiMessages);
    }
  }, [messagesFromConvex]);

  const messages = localMessages;
  const status: ChatStatus = messagesFromConvex?.some((m) => !m.isComplete)
    ? "streaming"
    : "ready";

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
      status,
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
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        {messages.length === 0 ? (
          // Centered input for new chat
          <div className="flex flex-1 items-center justify-center px-2 md:px-4">
            <div className="w-full max-w-4xl">
              <div className="mb-8 text-center">
                <h1 className="font-bold text-3xl text-foreground">
                  test chat
                </h1>
              </div>
              <div className="relative">
                <div className="relative">
                  <MultimodalInput
                    attachments={attachments}
                    chatId={id}
                    input={input}
                    messages={messages}
                    onModelChange={setCurrentModelId}
                    onReasoningEffortChange={setCurrentReasoningEffort}
                    onToolsChange={setSelectedTools}
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
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Normal layout with messages and bottom input
          <>
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

            <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={id}
                  input={input}
                  messages={messages}
                  onModelChange={setCurrentModelId}
                  onReasoningEffortChange={setCurrentReasoningEffort}
                  onToolsChange={setSelectedTools}
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
              )}
            </div>
          </>
        )}
      </div>

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
