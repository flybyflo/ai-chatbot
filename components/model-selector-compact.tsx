"use client";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { chatModels } from "@/lib/ai/models";

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: Readonly<{
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}>) {
  const [open, setOpen] = useState(false);
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
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    []
  );

  const selectModel = useCallback(
    (modelId: string) => {
      const model = chatModels.find((m) => m.id === modelId);
      if (!model) {
        return;
      }
      setOptimisticModelId(model.id);
      onModelChange?.(model.id);
      startTransition(() => {
        saveChatModelAsCookie(model.id);
      });
      setOpen(false);
    },
    [onModelChange]
  );

  // More compact width, no descriptions in the list
  const panelClass =
    "z-[1000] w-[260px] rounded-xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur";

  return (
    <Popover onOpenChange={setOpen} open={open}>
      {/* Trigger (unchanged visually) */}
      <PopoverTrigger asChild>
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
          type="button"
        >
          <Cpu size={16} />
          <span className="hidden font-medium text-xs sm:block">
            {selectedModel?.name}
          </span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className={panelClass}
        side="bottom"
        sideOffset={8}
      >
        {/* Search (compact) */}
        <div className="mx-0.5 mt-0.5 rounded-md border border-border/20 bg-(--tool-bg)">
          <input
            autoComplete="off"
            className="block w-full rounded-md bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70"
            onChange={handleSearchChange}
            placeholder="Search models…"
            ref={inputRef}
            type="text"
            value={q}
          />
        </div>

        {/* List — compact rows (no descriptions) */}
        <div className="max-h-[300px] space-y-1 overflow-y-auto p-1">
          {filteredModels.length === 0 ? (
            <div className="mx-1 my-1 rounded-sm bg-(--tool-bg) px-2 py-1.5 text-center text-muted-foreground text-xs">
              No models match your search
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = optimisticModelId === model.id;
              return (
                <button
                  className={`relative mx-0.5 w-[calc(100%-0.25rem)] cursor-default select-none rounded-md py-1.5 pr-2.5 pl-3 text-left text-xs outline-none transition-colors hover:bg-foreground/10 ${
                    isSelected ? "bg-foreground/15 font-semibold" : ""
                  }`}
                  key={model.id}
                  onClick={() => selectModel(model.id)}
                  type="button"
                >
                  <div className="truncate font-medium">{model.name}</div>
                  {isSelected ? (
                    <span className="-translate-y-1/2 absolute top-1/2 right-2">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ModelSelectorCompact = memo(PureModelSelectorCompact);
