"use client";

import { Trigger } from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { memo, startTransition, useEffect, useState } from "react";
import { SelectItem } from "@/components/ui/select";
import { triggerClass } from "../lib/styles";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

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

  const panelClass =
    "z-[1000] w-[240px] rounded-lg border border-border/30 bg-popover p-0 text-popover-foreground shadow-md backdrop-blur " +
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
      <Trigger className={triggerClass} type="button">
        <span className="font-medium text-xs">Reasoning Effort</span>
        <ChevronDown size={14} />
      </Trigger>

      <PromptInputModelSelectContent className={panelClass}>
        <div className="divide-y divide-border/20">
          {effortOptions.map((effort) => (
            <SelectItem
              className="relative w-full cursor-default select-none py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
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
