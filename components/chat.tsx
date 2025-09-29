"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { selectedToolsSchema } from "@/lib/schemas/tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
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

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentReasoningEffort, setCurrentReasoningEffort] = useState<
    "low" | "medium" | "high"
  >("high");
  const [selectedTools, setSelectedTools] = useState<string[]>(["getWeather"]);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const selectedToolsRef = useRef(selectedTools);
  const queryClient = useQueryClient();
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
    const cachedSelected = queryClient.getQueryData(["tools", "selected"]);
    try {
      const parsed = selectedToolsSchema.parse(cachedSelected ?? []);
      if (parsed.length > 0) {
        setSelectedTools(parsed);
      } else {
        const storedTools = localStorage.getItem("selected-tools");
        if (storedTools) {
          const parsedTools = JSON.parse(storedTools);
          if (Array.isArray(parsedTools) && parsedTools.length > 0) {
            setSelectedTools(parsedTools);
          }
        }
      }
    } catch {
      // Fallback to localStorage on validation failure
      const storedTools = localStorage.getItem("selected-tools");
      if (storedTools) {
        try {
          const parsedTools = JSON.parse(storedTools);
          if (Array.isArray(parsedTools) && parsedTools.length > 0) {
            setSelectedTools(parsedTools);
          }
        } catch {
          localStorage.removeItem("selected-tools");
        }
      }
    }
    setHasLoadedFromStorage(true);
  }, [queryClient]);

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
        queryClient.setQueryData(["tools", "selected"], validated);
        setStoreSelected(validated);
      } catch {
        // ignore validation errors
      }
    }
  }, [selectedTools, hasLoadedFromStorage, queryClient, setStoreSelected]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        console.log(
          "🔧 Frontend: Sending tools to API:",
          selectedToolsRef.current
        );
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            selectedReasoningEffort: currentReasoningEffort,
            selectedTools: selectedToolsRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      console.debug("🪄 UI data part", dataPart.type, dataPart);
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
      if (dataPart.type === "data-a2aEvents") {
        console.debug("🛰️ UI received A2A events", dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast.error(error.message);
        }
      }
    },
  });

  useEffect(() => {
    setDataStream([]);
  }, [setDataStream]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
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
