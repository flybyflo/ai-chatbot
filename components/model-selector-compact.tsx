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
}: Readonly<{
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}>) {
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

  // Trigger unchanged; panel uses tool-bg + rounded
  const panelClass =
    "z-[1000] w-[320px] rounded-2xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur " +
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
        {/* Search — rounded container with tool-bg */}
        <div className="mx-1 mt-1 rounded-xl border border-border/20 bg-(--tool-bg)">
          <input
            autoComplete="off"
            className="block w-full rounded-xl bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
            onChange={handleSearchChange}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search models…"
            ref={inputRef}
            type="text"
            value={q}
          />
        </div>

        {/* List — rounded rows */}
        <div className="max-h-[360px] space-y-1.5 overflow-y-auto p-1.5">
          {filteredModels.length === 0 ? (
            <div className="mx-2 my-1 rounded-lg bg-(--tool-bg) px-2 py-2 text-center text-muted-foreground text-xs">
              No models match your search
            </div>
          ) : (
            filteredModels.map((model) => (
              <SelectItem
                className="relative mx-1 w-[calc(100%-0.5rem)] cursor-default select-none rounded-xl py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
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
