"use client";

import { Brain, ChevronDown } from "lucide-react";
import { memo, startTransition, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function PureReasoningEffortSelector({
  selectedReasoningEffort,
  onReasoningEffortChange,
}: Readonly<{
  selectedReasoningEffort: "low" | "medium" | "high";
  onReasoningEffortChange?: (effort: "low" | "medium" | "high") => void;
}>) {
  const [open, setOpen] = useState(false);
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

  const choose = (effortValue: "low" | "medium" | "high") => {
    setOptimisticEffort(effortValue);
    onReasoningEffortChange?.(effortValue);
    startTransition(() => {
      localStorage.setItem("reasoning-effort", effortValue);
    });
    setOpen(false);
  };

  // Narrower width as requested
  const panelClass =
    "z-[1000] w-[200px] rounded-xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur";

  return (
    <Popover onOpenChange={setOpen} open={open}>
      {/* Trigger (unchanged visually) */}
      <PopoverTrigger asChild>
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
          type="button"
        >
          <Brain size={16} />
          <span className="font-medium text-xs">Reasoning Effort</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className={panelClass}
        side="bottom"
        sideOffset={8}
      >
        <div className="max-h-[280px] space-y-1 overflow-y-auto p-1">
          {effortOptions.map((effort) => {
            const isSelected = optimisticEffort === effort.value;
            return (
              <button
                className={`relative mx-0.5 w-[calc(100%-0.25rem)] cursor-default select-none rounded-md py-1.5 pr-2.5 pl-3 text-left text-xs outline-none transition-colors hover:bg-foreground/10 ${
                  isSelected ? "bg-foreground/15 font-semibold" : ""
                }`}
                key={effort.value}
                onClick={() => choose(effort.value)}
                type="button"
              >
                {effort.label}
                {isSelected && (
                  <span className="-translate-y-1/2 absolute top-1/2 right-2">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ReasoningEffortSelector = memo(PureReasoningEffortSelector);
