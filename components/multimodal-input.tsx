"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import { ArrowUp } from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useLoadouts } from "@/hooks/use-loadouts";
import { useAllTools } from "@/hooks/use-tools";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, generateUUID } from "@/lib/utils";
import { AttachmentsButton } from "./attachments-button";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import { LoadoutSelector } from "./loadout-selector";
import { ModelSelectorCompact } from "./model-selector-compact";
import { PreviewAttachment } from "./preview-attachment";
import { ReasoningEffortSelector } from "./reasoning-effort-selector";
import { StopButton } from "./stop-button";
import { ToolsSelector } from "./tools-selector";
import type { VisibilityType } from "./visibility-selector";

function PureMultimodalInput({
  activeLoadoutId,
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
  onActiveLoadoutChange,
}: {
  activeLoadoutId?: string | null;
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: (message: ChatMessage) => Promise<void>;
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  selectedReasoningEffort: "low" | "medium" | "high";
  onReasoningEffortChange?: (effort: "low" | "medium" | "high") => void;
  usage?: AppUsage;
  selectedTools?: string[];
  onToolsChange?: (tools: string[]) => void;
  onActiveLoadoutChange?: (id: string | null) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { loadouts } = useLoadouts();

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
    if (!textareaRef.current) {
      return;
    }
    const domValue = textareaRef.current.value;
    const finalValue = domValue || localStorageInput || "";
    setInput(finalValue);
    adjustHeight();
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
  const { mcpRegistry, a2aRegistry, tools: availableTools } = useAllTools();
  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    const message: ChatMessage = {
      id: generateUUID(),
      role: "user",
      parts: [{ type: "text", text: input }],
      attachments,
      metadata: { createdAt: new Date().toISOString() },
    };

    sendMessage(message).catch((error) => {
      console.error("Failed to send message:", error);
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
        return { url, name: pathname, contentType };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const contextProps = useMemo(() => ({ usage }), [usage]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setUploadQueue(files.map((f) => f.name));
      try {
        const uploaded = await Promise.all(files.map((f) => uploadFile(f)));
        const ok = uploaded.filter(Boolean) as Attachment[];
        setAttachments((prev) => [...prev, ...ok]);
      } catch (err) {
        console.error("Error uploading files!", err);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-3", className)}>
      <input
        accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.json,.csv,.xml,.yaml,.yml,.js,.ts,.html,.css,.py,.c,.cpp,.h,.hpp"
        className="-left-4 -top-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      {/* CONTAINER — minimal & modern: thin border, subtle shadow, tight padding */}
      <PromptInput
        className={cn(
          "rounded-3xl border bg-popover/70 p-2.5 shadow-sm backdrop-blur transition-colors duration-150",
          activeLoadoutId
            ? "border-purple-500/50 focus-within:border-purple-500 hover:border-purple-500/70"
            : "border-border/30 focus-within:border-border hover:border-muted-foreground/40"
        )}
        onSubmit={(event) => {
          event.preventDefault();
          if (status === "streaming") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-1.5 overflow-x-auto px-0.5"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((prev) =>
                    prev.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}
            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{ url: "", name: filename, contentType: "" }}
                isUploading
                key={filename}
              />
            ))}
          </div>
        )}

        {/* INPUT ROW — edge-to-edge, compact */}
        <div className="flex flex-row items-start gap-1.5 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0 bg-transparent px-1.5 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground/70 focus-visible:outline-none"
            data-testid="multimodal-input"
            disableAutoResize
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Send a message…"
            ref={textareaRef}
            rows={1}
            value={input}
          />
          <Context {...contextProps} />
        </div>

        {/* TOOLBAR — no top border/shadow, dense spacing */}
        <PromptInputToolbar className="border-t-0 p-0 shadow-none">
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

            <LoadoutSelector
              activeLoadoutId={activeLoadoutId ?? undefined}
              loadouts={loadouts.map((l) => {
                const updatedAtValue = l.updatedAt as unknown;
                let updatedAt: string | undefined;
                if (typeof updatedAtValue === "string") {
                  updatedAt = updatedAtValue;
                } else if (typeof updatedAtValue === "number") {
                  updatedAt = new Date(updatedAtValue).toISOString();
                } else if (
                  typeof updatedAtValue === "object" &&
                  updatedAtValue !== null &&
                  "toISOString" in updatedAtValue &&
                  typeof (updatedAtValue as { toISOString?: unknown })
                    .toISOString === "function"
                ) {
                  updatedAt = (
                    updatedAtValue as { toISOString: () => string }
                  ).toISOString();
                }

                return {
                  id: l.id,
                  name: l.name,
                  description: l.description || undefined,
                  tags: l.tags || undefined,
                  isDefault: l.isDefault,
                  updatedAt,
                };
              })}
              onActivate={(id) => {
                const normalizedId = (id as unknown as string | null) ?? null;
                onActiveLoadoutChange?.(normalizedId);
                if (!normalizedId) {
                  // Deselected - no toast needed, just clear the loadout
                  return;
                }
                const loadout = loadouts.find((l) => l.id === normalizedId);
                if (loadout && onToolsChange) {
                  // Apply selected tools from loadout
                  onToolsChange(loadout.selectedTools || []);
                  toast.success(`Activated loadout: ${loadout.name}`);
                }
              }}
            />
            <ToolsSelector
              a2aRegistry={a2aRegistry}
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
              className={cn(
                "size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-150",
                "hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              )}
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

export const MultimodalInput = memo(PureMultimodalInput, (prev, next) => {
  if (prev.input !== next.input) {
    return false;
  }
  if (prev.status !== next.status) {
    return false;
  }
  if (!equal(prev.attachments, next.attachments)) {
    return false;
  }
  if (prev.selectedVisibilityType !== next.selectedVisibilityType) {
    return false;
  }
  if (prev.selectedModelId !== next.selectedModelId) {
    return false;
  }
  if (prev.selectedReasoningEffort !== next.selectedReasoningEffort) {
    return false;
  }
  if (!equal(prev.selectedTools, next.selectedTools)) {
    return false;
  }
  if (prev.activeLoadoutId !== next.activeLoadoutId) {
    return false;
  }
  if (prev.onActiveLoadoutChange !== next.onActiveLoadoutChange) {
    return false;
  }
  if (prev.onModelChange !== next.onModelChange) {
    return false;
  }
  if (prev.onReasoningEffortChange !== next.onReasoningEffortChange) {
    return false;
  }
  if (prev.onToolsChange !== next.onToolsChange) {
    return false;
  }
  return true;
});
