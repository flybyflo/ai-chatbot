import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { Fragment, memo, useEffect, useMemo } from "react";
import { useA2AEvents } from "@/hooks/use-a2a-events";
import { useMessages } from "@/hooks/use-messages";

type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

import type { ChatMessage } from "@/lib/types";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import MessageA2A from "./message-a2a";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  selectedModelId: string;
};

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  const events = useA2AEvents();

  const eventsAfterMessage = useMemo(() => {
    console.group("[A2A-MESSAGES] Mapping Events to Messages");
    console.log("Chat ID:", chatId);
    console.log("Total events:", events.length);
    console.log("Total messages:", messages.length);

    const map = new Map<number, ReturnType<typeof useA2AEvents>[number][]>();
    if (events.length === 0) {
      console.log("No events to map");
      console.groupEnd();
      return map;
    }

    const messageMeta = messages.map((message, index) => ({
      index,
      role: message.role,
      time: message.metadata?.createdAt
        ? new Date(message.metadata.createdAt).getTime()
        : index,
    }));

    console.log("Message metadata:", messageMeta.map((m) => ({
      index: m.index,
      role: m.role,
      time: new Date(m.time).toISOString(),
    })));

    for (const event of events) {
      const eventTime = event.timestamp
        ? new Date(event.timestamp).getTime()
        : Number.MAX_SAFE_INTEGER;

      let targetIndex = messageMeta.length - 1;
      for (let i = messageMeta.length - 1; i >= 0; i--) {
        const meta = messageMeta[i];
        if (meta.role !== "user") {
          continue;
        }
        if (meta.time <= eventTime) {
          targetIndex = meta.index;
          break;
        }
      }

      // Skip if targetIndex is invalid (no messages or no valid target found)
      if (targetIndex < 0 || targetIndex >= messageMeta.length) {
        console.log("[A2A-MESSAGES] Skipping event - invalid target index:", {
          eventAgentToolId: event.agentToolId,
          eventTimestamp: event.timestamp,
          targetIndex,
          messageMetaLength: messageMeta.length,
        });
        continue;
      }

      console.log("[A2A-MESSAGES] Mapped event to message:", {
        eventAgentToolId: event.agentToolId,
        eventTimestamp: event.timestamp,
        targetMessageIndex: targetIndex,
        targetMessageTime: new Date(messageMeta[targetIndex].time).toISOString(),
      });

      const existing = map.get(targetIndex) ?? [];
      existing.push(event);
      map.set(targetIndex, existing);
    }

    console.log("Events mapped to message indices:", Array.from(map.entries()).map(([idx, evts]) => ({
      messageIndex: idx,
      eventCount: evts.length,
    })));
    console.groupEnd();

    return map;
  }, [events, messages, chatId]);

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => {
            const eventsForMessage = eventsAfterMessage.get(index) ?? [];

            if (eventsForMessage.length > 0) {
              console.group(`[A2A-MESSAGES] Rendering message ${index}`);
              console.log("Message ID:", message.id);
              console.log("Message role:", message.role);
              console.log("Events for this message:", eventsForMessage.length);
            }

            const latestEventsByTask = (() => {
              if (eventsForMessage.length <= 1) {
                return eventsForMessage;
              }
              const byTask = new Map<
                string,
                ReturnType<typeof useA2AEvents>[number]
              >();
              for (const event of eventsForMessage) {
                const key =
                  event.primaryTaskId ??
                  event.contextId ??
                  event.agentToolId ??
                  `${index}`;
                const existing = byTask.get(key);
                if (!existing) {
                  byTask.set(key, event);
                  continue;
                }
                const existingTime = existing.timestamp
                  ? new Date(existing.timestamp).getTime()
                  : Number.NEGATIVE_INFINITY;
                const currentTime = event.timestamp
                  ? new Date(event.timestamp).getTime()
                  : Number.POSITIVE_INFINITY;
                if (currentTime >= existingTime) {
                  console.log(`[A2A-MESSAGES] Replaced event for task ${key}:`, {
                    oldTimestamp: existing.timestamp,
                    newTimestamp: event.timestamp,
                  });
                  byTask.set(key, event);
                }
              }
              const result = Array.from(byTask.values());
              console.log("Deduped events by task:", result.length);
              if (eventsForMessage.length > 0) {
                console.groupEnd();
              }
              return result;
            })();
            const showThinkingAfterMessage =
              (status === "submitted" || status === "streaming") &&
              index === messages.length - 1 &&
              message.role === "user" &&
              selectedModelId !== "chat-model-reasoning";
            return (
              <Fragment key={message.id}>
                <PreviewMessage
                  chatId={chatId}
                  isLoading={
                    status === "streaming" &&
                    messages.length - 1 === index &&
                    message.role === "assistant"
                  }
                  isReadonly={isReadonly}
                  message={message}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    hasSentMessage && index === messages.length - 1
                  }
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
                {showThinkingAfterMessage && <ThinkingMessage />}
                {latestEventsByTask.map((event, eventIndex) => {
                  const fallbackId = `${event.agentToolId ?? "a2a"}-${index}`;
                  const eventIdentifier =
                    event.primaryTaskId ||
                    event.contextId ||
                    event.messages?.[event.messages.length - 1]?.messageId ||
                    fallbackId;
                  const eventKey = `${eventIdentifier}-${event.timestamp ?? eventIndex}`;

                  return (
                    <MessageA2A
                      enableAnimation={
                        status === "streaming" && index === messages.length - 1
                      }
                      event={event}
                      isStreaming={
                        status === "streaming" && index === messages.length - 1
                      }
                      key={eventKey}
                      tasks={event.tasks}
                    />
                  );
                })}
              </Fragment>
            );
          })}
          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          aria-label="Scroll to bottom"
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return false;
});
