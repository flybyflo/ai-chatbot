import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { Fragment, memo, useEffect, useMemo } from "react";
import { A2ATaskProgress } from "@/components/a2a";
import { useA2AEvents } from "@/hooks/use-a2a-events";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { MessageA2A } from "./message-a2a";

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
  const { a2aSessions } = useDataStream();

  const eventsAfterMessage = useMemo(() => {
    const map = new Map<number, ReturnType<typeof useA2AEvents>[number][]>();
    if (events.length === 0) {
      return map;
    }

    const messageMeta = messages.map((message, index) => ({
      index,
      role: message.role,
      time: message.metadata?.createdAt
        ? new Date(message.metadata.createdAt).getTime()
        : index,
    }));

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

      const existing = map.get(targetIndex) ?? [];
      existing.push(event);
      map.set(targetIndex, existing);
    }

    return map;
  }, [events, messages]);

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
                {eventsForMessage.map((event, eventIndex) => {
                  const eventKey =
                    event.messages?.[event.messages.length - 1]?.messageId ||
                    event.timestamp ||
                    `${event.agentToolId}-${index}-${eventIndex}`;

                  const tasksForEvent = event.tasks || [];

                  return (
                    <Fragment key={eventKey}>
                      <MessageA2A event={event} />
                      {tasksForEvent.map((task) => (
                        <A2ATaskProgress
                          agentName={event.agentName}
                          key={`${eventKey}-task-${task.taskId}`}
                          task={task}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}

          {status === "submitted" &&
            messages.length > 0 &&
            messages.at(-1)?.role === "user" &&
            selectedModelId !== "chat-model-reasoning" && <ThinkingMessage />}

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
