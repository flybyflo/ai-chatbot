"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { CodeBlock } from "./elements/code-block";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        <div
          className={cn("flex flex-col", {
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            // Always full-width for assistant messages so tools don't resize dynamically
            "w-full": message.role === "assistant" || mode === "edit",
            "max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {(() => {
            const flowItems: Array<
              | { kind: "reasoning"; content: string; originalIndex: number }
              | { kind: "text"; index: number }
              | { kind: "tool-getWeather"; part: any }
              | { kind: "dynamic-tool"; part: any }
            > = [];

            let currentReasoning = "";
            let firstReasoningIndex = -1;

            const flushReasoning = () => {
              if (currentReasoning) {
                flowItems.push({
                  kind: "reasoning",
                  content: currentReasoning,
                  originalIndex: firstReasoningIndex,
                });
                currentReasoning = "";
                firstReasoningIndex = -1;
              }
            };

            message.parts?.forEach((part, index) => {
              if (part.type === "reasoning" && part.text?.trim()) {
                if (currentReasoning === "") {
                  firstReasoningIndex = index;
                  currentReasoning = part.text;
                } else {
                  currentReasoning += `\n\n${part.text}`;
                }
                return;
              }

              // Non-reasoning: flush any pending reasoning before handling
              flushReasoning();

              if (part.type === "text" && part.text?.trim()) {
                flowItems.push({ kind: "text", index });
                return;
              }

              if (part.type === "tool-getWeather") {
                flowItems.push({ kind: "tool-getWeather", part });
                return;
              }

              if (part.type === "dynamic-tool") {
                flowItems.push({ kind: "dynamic-tool", part });
                return;
              }
            });

            // Trailing reasoning, if any
            flushReasoning();

            const hasRenderedBeforeFlow = attachmentsFromMessage.length > 0;

            return flowItems.map((item, flowIndex) => {
              const needsTopMargin = hasRenderedBeforeFlow || flowIndex > 0;

              if (item.kind === "reasoning") {
                const key = `message-${message.id}-reasoning-${item.originalIndex}`;
                return (
                  <MessageReasoning
                    className={needsTopMargin ? "mt-3" : undefined}
                    isLoading={isLoading && flowIndex === flowItems.length - 1}
                    key={key}
                    reasoning={item.content}
                  />
                );
              }

              if (item.kind === "text") {
                const part = message.parts?.[item.index];
                const key = `message-${message.id}-part-${item.index}`;
                if (!part) {
                  return null;
                }
                if (part.type !== "text") {
                  return null;
                }

                if (mode === "view") {
                  return (
                    <div
                      className={cn(
                        "w-full",
                        needsTopMargin ? "mt-3" : undefined
                      )}
                      key={key}
                    >
                      <MessageContent
                        className={cn({
                          "w-fit break-words rounded-2xl px-3 py-2 text-right text-white":
                            message.role === "user",
                          "bg-transparent px-0 py-0 text-left":
                            message.role === "assistant",
                        })}
                        data-testid="message-content"
                        style={
                          message.role === "user"
                            ? { backgroundColor: "#006cff" }
                            : undefined
                        }
                      >
                        <Response>{sanitizeText(part.text)}</Response>
                      </MessageContent>
                    </div>
                  );
                }

                if (mode === "edit") {
                  return (
                    <div
                      className={cn(
                        "flex w-full flex-row items-start gap-3",
                        needsTopMargin && "mt-3"
                      )}
                      key={key}
                    >
                      <div className="size-8" />
                      <div className="min-w-0 flex-1">
                        <MessageEditor
                          key={message.id}
                          message={message}
                          regenerate={regenerate}
                          setMessages={setMessages}
                          setMode={setMode}
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              }

              if (item.kind === "tool-getWeather") {
                const { toolCallId, state } = item.part;
                return (
                  <div
                    className={cn(
                      "w-full",
                      needsTopMargin ? "mt-3" : undefined
                    )}
                    key={toolCallId}
                  >
                    <Tool defaultOpen={false}>
                      <ToolHeader
                        inputParams={item.part.input}
                        state={state}
                        type="weather::getWeather"
                      />
                      <ToolContent>
                        {state === "input-available" && (
                          <ToolInput input={item.part.input} />
                        )}
                        {state === "output-available" && (
                          <ToolOutput
                            errorText={undefined}
                            output={
                              <div className="rounded-md bg-muted/50">
                                <CodeBlock
                                  code={JSON.stringify(
                                    item.part.output,
                                    null,
                                    2
                                  )}
                                  language="json"
                                />
                              </div>
                            }
                          />
                        )}
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              if (item.kind === "dynamic-tool") {
                const { toolCallId, state, toolName: fullToolName } = item.part;
                if (fullToolName.includes("_")) {
                  const parts = fullToolName.split("_");
                  const serverName = parts.slice(0, -1).join("_");
                  const toolName = parts.at(-1);

                  return (
                    <div
                      className={cn(
                        "w-full",
                        needsTopMargin ? "mt-3" : undefined
                      )}
                      key={toolCallId}
                    >
                      <Tool defaultOpen={false}>
                        <ToolHeader
                          inputParams={item.part.input}
                          state={state}
                          type={`${serverName}::${toolName}`}
                        />
                        <ToolContent>
                          {state === "input-available" && (
                            <ToolInput input={item.part.input} />
                          )}
                          {state === "output-available" && (
                            <ToolOutput
                              errorText={
                                "errorText" in item.part
                                  ? item.part.errorText
                                  : undefined
                              }
                              output={
                                <div className="rounded-md bg-muted/50">
                                  <CodeBlock
                                    code={JSON.stringify(
                                      item.part.output,
                                      null,
                                      2
                                    )}
                                    language="json"
                                  />
                                </div>
                              }
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    </div>
                  );
                }
                return null;
              }

              return null;
            });
          })()}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return false;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex h-6 w-20 shrink-0 items-center justify-center rounded-full bg-background">
          <LoadingText>Thinking...</LoadingText>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ["100% 50%", "-100% 50%"] }}
      className="flex items-center justify-center font-medium text-transparent text-xs"
      style={{
        background:
          "linear-gradient(90deg, rgb(107 114 128) 0%, rgb(107 114 128) 35%, rgb(229 231 235) 50%, rgb(107 114 128) 65%, rgb(107 114 128) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        width: "100%",
        height: "100%",
      }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
};
