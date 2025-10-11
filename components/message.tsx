"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import { CodeComparison } from "@/components/ui/code-comparison";
import { PlantUMLViewer } from "@/components/ui/plantuml-viewer";

type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

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

const TASK_STATE_SPLIT_REGEX = /[-_\s]+/;

const _formatTaskState = (state?: string) => {
  if (!state) {
    return;
  }
  return state
    .split(TASK_STATE_SPLIT_REGEX)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const _sanitizeOptionalText = (value?: string) => {
  if (typeof value !== "string") {
    return "";
  }
  const sanitized = sanitizeText(value);
  return sanitized;
};

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

  const attachmentsFromMessage = (message.parts ?? []).filter(
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
              | {
                  kind: "reasoning";
                  content: string;
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "text";
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "tool-getWeather";
                  part: any;
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "tool-codeCompare";
                  part: any;
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "tool-plantuml";
                  part: any;
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "tool-a2a";
                  agentKey: string;
                  part: any;
                  originalIndex: number;
                  sequence: number;
                }
              | {
                  kind: "dynamic-tool";
                  part: any;
                  originalIndex: number;
                  sequence: number;
                }
            > = [];

            let sequenceCounter = 0;

            let currentReasoning = "";
            let firstReasoningIndex = -1;

            const flushReasoning = () => {
              if (currentReasoning) {
                flowItems.push({
                  kind: "reasoning",
                  content: currentReasoning,
                  originalIndex: firstReasoningIndex,
                  sequence: sequenceCounter++,
                });
                currentReasoning = "";
                firstReasoningIndex = -1;
              }
            };

            message.parts?.forEach((part, index) => {
              const partText =
                typeof (part as { text?: string }).text === "string"
                  ? (part as { text?: string }).text
                  : undefined;

              if (part.type === "reasoning" && partText?.trim()) {
                if (currentReasoning === "") {
                  firstReasoningIndex = index;
                  currentReasoning = partText;
                } else {
                  currentReasoning += `\n\n${partText}`;
                }
                return;
              }

              // Non-reasoning: flush any pending reasoning before handling
              flushReasoning();

              if (part.type === "text" && partText?.trim()) {
                flowItems.push({
                  kind: "text",
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

              if (part.type === "tool-getWeather") {
                flowItems.push({
                  kind: "tool-getWeather",
                  part,
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

              if (part.type === "tool-codeCompare") {
                flowItems.push({
                  kind: "tool-codeCompare",
                  part,
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

              if (part.type === "tool-plantuml") {
                flowItems.push({
                  kind: "tool-plantuml",
                  part,
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

              if (
                typeof part.type === "string" &&
                part.type.startsWith("tool-a2a_")
              ) {
                const agentKey =
                  part.type.slice("tool-a2a_".length) || "unknown";
                flowItems.push({
                  kind: "tool-a2a",
                  agentKey,
                  part,
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

              if (part.type === "dynamic-tool") {
                flowItems.push({
                  kind: "dynamic-tool",
                  part,
                  originalIndex: index,
                  sequence: sequenceCounter++,
                });
                return;
              }

            });

            // Trailing reasoning, if any
            flushReasoning();

            const hasRenderedBeforeFlow = attachmentsFromMessage.length > 0;

            const sortedFlowItems = [...flowItems].sort((a, b) => {
              if (a.originalIndex === b.originalIndex) {
                return a.sequence - b.sequence;
              }
              return a.originalIndex - b.originalIndex;
            });

            return sortedFlowItems.map((item, flowIndex) => {
              const needsTopMargin = hasRenderedBeforeFlow || flowIndex > 0;

              if (item.kind === "reasoning") {
                const key = `message-${message.id}-reasoning-${item.originalIndex}`;
                return (
                  <MessageReasoning
                    className={needsTopMargin ? "mt-3" : undefined}
                    isLoading={
                      isLoading && flowIndex === sortedFlowItems.length - 1
                    }
                    key={key}
                    reasoning={item.content}
                  />
                );
              }

              if (item.kind === "text") {
                const part = message.parts?.[item.originalIndex];
                const key = `message-${message.id}-part-${item.originalIndex}`;
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
                const { toolCallId } = item.part;
                const input = item.part.input || {};
                const output = (item.part.output as any) || {};
                const latitude: number | undefined = input.latitude;
                const longitude: number | undefined = input.longitude;

                const currentTemp = output?.current?.temperature_2m as
                  | number
                  | undefined;
                const sunrise = Array.isArray(output?.daily?.sunrise)
                  ? output.daily.sunrise[0]
                  : undefined;
                const sunset = Array.isArray(output?.daily?.sunset)
                  ? output.daily.sunset[0]
                  : undefined;

                return (
                  <div
                    className={cn(
                      "w-full",
                      needsTopMargin ? "mt-3" : undefined
                    )}
                    key={toolCallId}
                  >
                    <div className="rounded-[1.3rem] border border-border bg-tool-bg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">Weather</div>
                        {typeof latitude === "number" &&
                          typeof longitude === "number" && (
                            <div className="text-muted-foreground text-xs">
                              lat {latitude.toFixed(3)}, lon{" "}
                              {longitude.toFixed(3)}
                            </div>
                          )}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="text-xs">
                          <div className="text-muted-foreground">
                            Temperature
                          </div>
                          <div>
                            {typeof currentTemp === "number"
                              ? `${currentTemp}°C`
                              : "Fetching..."}
                          </div>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">Sunrise</div>
                          <div>{sunrise ?? "–"}</div>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">Sunset</div>
                          <div>{sunset ?? "–"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.kind === "tool-codeCompare") {
                const { toolCallId } = item.part;
                const input = item.part.input || {};
                const output = item.part.output || {};
                // Merge output over input so final values override while preserving streamed input
                const payload = {
                  ...(typeof input === "object" && input ? input : {}),
                  ...(typeof output === "object" && output ? output : {}),
                } as any;
                const filename = payload.filename ?? "file";
                const beforeCode = payload.beforeCode ?? "";
                const afterCode = payload.afterCode ?? "";
                const language = payload.language ?? "plaintext";
                const lightTheme = payload.lightTheme ?? "github-light";
                const darkTheme = payload.darkTheme ?? "github-dark";
                const highlightColor = payload.highlightColor;

                return (
                  <div
                    className={cn(
                      "w-full",
                      needsTopMargin ? "mt-3" : undefined
                    )}
                    key={toolCallId}
                  >
                    <CodeComparison
                      afterCode={afterCode}
                      beforeCode={beforeCode}
                      darkTheme={darkTheme}
                      filename={filename}
                      highlightColor={highlightColor}
                      language={language}
                      lightTheme={lightTheme}
                    />
                  </div>
                );
              }

              if (item.kind === "tool-plantuml") {
                const { toolCallId } = item.part;
                const input = item.part.input || {};
                const output = item.part.output || {};
                // Merge output over input so final values override while preserving streamed input
                const payload = {
                  ...(typeof input === "object" && input ? input : {}),
                  ...(typeof output === "object" && output ? output : {}),
                } as any;
                const code = payload.code ?? "";
                const title = payload.title ?? "PlantUML Diagram";
                const language = payload.language ?? "plantuml";
                const lightTheme = payload.lightTheme ?? "github-light";
                const darkTheme = payload.darkTheme ?? "github-dark";
                const needsMargin = hasRenderedBeforeFlow || flowIndex > 0;
                return (
                  <div
                    className={cn("w-full", needsMargin ? "mt-3" : undefined)}
                    key={toolCallId}
                  >
                    <PlantUMLViewer
                      code={code}
                      darkTheme={darkTheme}
                      language={language}
                      lightTheme={lightTheme}
                      title={title}
                    />
                  </div>
                );
              }

              // A2A events are now rendered via MessageA2A in messages.tsx
              // This duplicate rendering has been removed
              if (item.kind === "tool-a2a") {
                return null;
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
