"use client";

import { Trigger } from "@radix-ui/react-select";
import { Brain, ChevronDown } from "lucide-react";
import { memo, startTransition, useEffect, useState } from "react";
import { SelectItem } from "@/components/ui/select";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

function PureReasoningEffortSelector({
  selectedReasoningEffort,
  onReasoningEffortChange,
}: Readonly<{
  selectedReasoningEffort: "low" | "medium" | "high";
  onReasoningEffortChange?: (effort: "low" | "medium" | "high") => void;
}>) {
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

  // Trigger unchanged; panel uses tool-bg + rounded
  const panelClass =
    "z-[1000] w-[240px] rounded-2xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

  return (
    <PromptInputModelSelect
      onValueChange={(effortLabel) => {
        const effort = effortOptions.find((e) => e.label === effortLabel);
        if (!effort) {
          return;
        }
        setOptimisticEffort(effort.value);
        onReasoningEffortChange?.(effort.value);
        startTransition(() => {
          localStorage.setItem("reasoning-effort", effort.value);
        });
      }}
      value={effortOptions.find((e) => e.value === optimisticEffort)?.label}
    >
      <Trigger
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
        type="button"
      >
        <Brain size={16} />
        <span className="font-medium text-xs">Reasoning Effort</span>
        <ChevronDown size={14} />
      </Trigger>

      <PromptInputModelSelectContent className={panelClass}>
        <div className="max-h-[320px] space-y-1.5 overflow-y-auto p-1.5">
          {effortOptions.map((effort) => (
            <SelectItem
              className="relative mx-1 w-[calc(100%-0.5rem)] cursor-default select-none rounded-xl py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
              key={effort.value}
              value={effort.label}
            >
              {effort.label}
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const ReasoningEffortSelector = memo(PureReasoningEffortSelector);
