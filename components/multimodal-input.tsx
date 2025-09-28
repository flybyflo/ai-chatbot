"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import { ArrowUp, ChevronDown, Cpu, Paperclip, Square } from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { useAllTools, useSelectedTools } from "@/hooks/use-tools";
import { chatModels } from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import { PreviewAttachment } from "./preview-attachment";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages: _messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType: _selectedVisibilityType,
  selectedModelId,
  onModelChange,
  selectedReasoningEffort,
  onReasoningEffortChange,
  usage,
  selectedTools,
  onToolsChange,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  selectedReasoningEffort: "low" | "medium" | "high";
  onReasoningEffortChange?: (effort: "low" | "medium" | "high") => void;
  usage?: AppUsage;
  selectedTools?: string[];
  onToolsChange?: (tools: string[]) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const { mcpRegistry, tools: availableTools } = useAllTools();
  // Validate and persist selection only when tools are ready; avoids accidental deselection
  useSelectedTools(selectedTools, onToolsChange);

  // Validation handled by useSelectedTools

  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    // Use AI SDK's native attachment system
    const fileAttachments = attachments.map((attachment) => ({
      type: "file" as const,
      filename: attachment.name,
      mediaType: attachment.contentType,
      url: attachment.url,
    }));

    sendMessage({
      text: input,
      files: fileAttachments,
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  // Model resolver for potential future use
  // const _modelResolver = useMemo(() => {
  //   try {
  //     return myProvider.languageModel(selectedModelId);
  //   } catch (_error) {
  //     // Fallback to default model if selectedModelId doesn't exist
  //     return myProvider.languageModel("chat-model");
  //   }
  // }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      <input
        accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.json,.csv,.xml,.yaml,.yml,.js,.ts,.html,.css,.py,.c,.cpp,.h,.hpp"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-[1.3rem] border border-border bg-tool-bg p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Send a message..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
            <ReasoningEffortSelector
              onReasoningEffortChange={onReasoningEffortChange}
              selectedReasoningEffort={selectedReasoningEffort}
            />
            <ToolsSelector
              availableTools={availableTools}
              mcpRegistry={mcpRegistry}
              onToolsChange={onToolsChange}
              selectedTools={selectedTools}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
            >
              <ArrowUp size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (
      prevProps.selectedReasoningEffort !== nextProps.selectedReasoningEffort
    ) {
      return false;
    }
    if (!equal(prevProps.selectedTools, nextProps.selectedTools)) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <Paperclip size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-3 text-foreground shadow-none transition-all duration-200 hover:bg-foreground/25 hover:shadow-md focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/25 data-[state=open]:shadow-md"
        type="button"
      >
        <Cpu size={16} />
        <span className="hidden font-medium text-xs sm:block">
          {selectedModel?.name}
        </span>
        <ChevronDown size={16} />
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] rounded-xl border-2 border-[#87CEFA]/30 bg-tool-bg/95 p-1 shadow-lg backdrop-blur-sm dark:border-[#4A90E2]/30">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem
              className="hover:bg-foreground/20 focus:bg-foreground/20"
              key={model.id}
              value={model.name}
            >
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureReasoningEffortSelector({
  selectedReasoningEffort,
  onReasoningEffortChange,
}: {
  selectedReasoningEffort: "low" | "medium" | "high";
  onReasoningEffortChange?: (effort: "low" | "medium" | "high") => void;
}) {
  const [optimisticEffort, setOptimisticEffort] = useState(
    selectedReasoningEffort
  );

  useEffect(() => {
    setOptimisticEffort(selectedReasoningEffort);
  }, [selectedReasoningEffort]);

  const effortOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ] as const;

  return (
    <PromptInputModelSelect
      onValueChange={(effortLabel) => {
        const effort = effortOptions.find((e) => e.label === effortLabel);
        if (effort) {
          setOptimisticEffort(effort.value);
          onReasoningEffortChange?.(effort.value);
          startTransition(() => {
            localStorage.setItem("reasoning-effort", effort.value);
          });
        }
      }}
      value={effortOptions.find((e) => e.value === optimisticEffort)?.label}
    >
      <Trigger
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-3 text-foreground shadow-none transition-all duration-200 hover:bg-foreground/25 hover:shadow-md focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/25 data-[state=open]:shadow-md"
        type="button"
      >
        <span className="font-medium text-xs">Reasoning Effort</span>
        <ChevronDown size={16} />
      </Trigger>
      <PromptInputModelSelectContent className="rounded-xl border-2 border-[#87CEFA]/30 bg-tool-bg/95 p-1 shadow-lg backdrop-blur-sm dark:border-[#4A90E2]/30">
        {effortOptions.map((effort) => (
          <SelectItem
            className="hover:bg-foreground/20 focus:bg-foreground/20"
            key={effort.value}
            value={effort.label}
          >
            {effort.label}
          </SelectItem>
        ))}
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ReasoningEffortSelector = memo(PureReasoningEffortSelector);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <Square size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureToolsSelector({
  selectedTools = [],
  onToolsChange,
  mcpRegistry: _mcpRegistry,
  availableTools = [],
}: {
  selectedTools?: string[];
  onToolsChange?: (tools: string[]) => void;
  mcpRegistry?: any;
  availableTools?: any[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const allTools =
    availableTools.length > 0
      ? availableTools
      : [
          {
            id: "getWeather",
            name: "Get Weather",
            description: "Get current weather information for a location",
            type: "local" as const,
          },
          {
            id: "codeCompare",
            name: "Code Compare",
            description:
              "Render a side-by-side comparison given filename, before and after code",
            type: "local" as const,
          },
          {
            id: "plantuml",
            name: "PlantUML Diagram",
            description:
              "Create and render PlantUML diagrams with source code viewer",
            type: "local" as const,
          },
        ];

  // Filter tools based on search term
  const filteredTools = allTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTool = (toolId: string) => {
    if (!onToolsChange) {
      return;
    }

    const newSelectedTools = selectedTools.includes(toolId)
      ? selectedTools.filter((id) => id !== toolId)
      : [...selectedTools, toolId];

    console.log(
      "🔧 Frontend: Tool toggled:",
      toolId,
      "New selection:",
      newSelectedTools
    );
    onToolsChange(newSelectedTools);
  };

  return (
    <PromptInputModelSelect
      onValueChange={() => {
        // Handled by individual tool clicks
      }}
    >
      <Trigger
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-transparent px-3 text-foreground shadow-none transition-all duration-200 hover:bg-foreground/25 hover:shadow-md focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/25 data-[state=open]:shadow-md"
        type="button"
      >
        <span className="font-medium text-xs">Tools</span>
        <ChevronDown size={14} />
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[320px] rounded-xl border-2 border-[#87CEFA]/30 bg-tool-bg/95 p-1 shadow-lg backdrop-blur-sm dark:border-[#4A90E2]/30">
        {/* Search Input */}
        <div className="border-border/20 border-b p-2">
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-sm transition-all duration-200 hover:border-border/50 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/20"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tools..."
            type="text"
            value={searchTerm}
          />
        </div>

        {/* Scrollable Tools List */}
        <div className="max-h-[300px] overflow-y-auto">
          <div className="flex flex-col gap-px">
            {filteredTools.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground text-xs">
                {searchTerm
                  ? "No tools match your search"
                  : "No tools available"}
              </div>
            ) : (
              filteredTools.map((tool) => (
                <button
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left transition-colors duration-200 hover:bg-foreground/20"
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  type="button"
                >
                  <input
                    checked={selectedTools.includes(tool.id)}
                    className="size-3 rounded border border-border"
                    onChange={() => {
                      // Handled by parent onClick
                    }}
                    type="checkbox"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-xs">
                        {tool.name}
                      </span>
                      {tool.type === "mcp" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          MCP
                        </span>
                      )}
                      {tool.type === "local" && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900 dark:text-green-300">
                          Local
                        </span>
                      )}
                    </div>
                    <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                      {tool.description.length > 50
                        ? `${tool.description.slice(0, 50)}...`
                        : tool.description}
                      {tool.type === "mcp" && tool.serverName && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          ({tool.serverName})
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ToolsSelector = memo(PureToolsSelector);
