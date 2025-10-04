"use client";

import { Trigger } from "@radix-ui/react-select";
import { ChevronDown, Cpu } from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { chatModels } from "@/lib/ai/models";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find((m) => m.id === optimisticModelId);

  const filteredModels = useMemo(() => {
    if (!q) {
      return chatModels;
    }
    const s = q.toLowerCase();
    return chatModels.filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        m.id.toLowerCase().includes(s) ||
        (m.description ?? "").toLowerCase().includes(s)
    );
  }, [q]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQ(e.target.value);
      // Maintain focus after state update
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    []
  );

  // Focus the input when the dropdown opens
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);

  const handleValueChange = useCallback(
    (modelName: string) => {
      const model = chatModels.find((m) => m.name === modelName);
      if (!model) {
        return;
      }
      setOptimisticModelId(model.id);
      onModelChange?.(model.id);
      startTransition(() => {
        saveChatModelAsCookie(model.id);
      });
    },
    [onModelChange]
  );

  const panelClass =
    "z-[1000] w-[320px] rounded-lg border border-border/30 bg-popover p-0 text-popover-foreground shadow-md backdrop-blur " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

  return (
    <PromptInputModelSelect
      onOpenChange={handleOpenChange}
      onValueChange={handleValueChange}
      value={selectedModel?.name}
    >
      <Trigger
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
        type="button"
      >
        <Cpu size={16} />
        <span className="hidden font-medium text-xs sm:block">
          {selectedModel?.name}
        </span>
        <ChevronDown size={14} />
      </Trigger>

      <PromptInputModelSelectContent className={panelClass}>
        {/* Edge-to-edge search */}
        <div className="border-border/20 border-b">
          <input
            autoComplete="off"
            className="block w-full bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
            onChange={handleSearchChange}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search models…"
            ref={inputRef}
            type="text"
            value={q}
          />
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {filteredModels.length === 0 ? (
            <div className="px-2 py-2 text-center text-muted-foreground text-xs">
              No models match your search
            </div>
          ) : (
            filteredModels.map((model) => (
              <SelectItem
                className="relative w-full cursor-default select-none py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
                key={model.id}
                value={model.name}
              >
                <div className="truncate font-medium">{model.name}</div>
                {model.description && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground leading-tight">
                    {model.description}
                  </div>
                )}
              </SelectItem>
            ))
          )}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const ModelSelectorCompact = memo(PureModelSelectorCompact);
