"use client";

import { Trigger } from "@radix-ui/react-select";
import { Brain, ChevronDown } from "lucide-react";
import { memo, startTransition, useEffect, useState } from "react";
import { SelectItem } from "@/components/ui/select";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";
import { cn } from "@/lib/utils";

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

  const panelClass = cn(
    "z-[1000] w-[240px] overflow-hidden rounded-xl border border-border/60 bg-white/95 text-foreground shadow-xl",
    "backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/90",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
  );

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
        <div className="divide-y divide-border/30 bg-white/40 dark:divide-zinc-800/60 dark:bg-transparent">
          {effortOptions.map((effort) => (
            <SelectItem
              className={cn(
                "flex w-full cursor-default select-none items-center gap-2 px-3 py-2 text-xs font-medium",
                "text-foreground/90 transition-colors",
                "data-[highlighted]:bg-muted/60 data-[state=checked]:bg-muted data-[state=checked]:text-foreground"
              )}
              key={effort.value}
              value={effort.label}
            >
              <span className="h-2 w-2 rounded-full bg-primary/70 dark:bg-primary" />
              {effort.label}
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const ReasoningEffortSelector = memo(PureReasoningEffortSelector);
