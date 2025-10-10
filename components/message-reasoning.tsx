"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "./elements/reasoning";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
  className?: string;
};

export function MessageReasoning({
  isLoading,
  reasoning,
  className,
}: MessageReasoningProps) {
  console.log("🤔 [MessageReasoning] Component rendered:", {
    isLoading,
    reasoningLength: reasoning.length,
    reasoningPreview: reasoning.substring(0, 100),
  });

  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      console.log("▶️ [MessageReasoning] Setting hasBeenStreaming to true");
      setHasBeenStreaming(true);
    }
  }, [isLoading]);

  // Estimate duration based on reasoning content length
  // Rough estimate: ~50 characters per second of thinking
  const estimatedDuration = Math.max(1, Math.round(reasoning.length / 50));

  console.log("🔧 [MessageReasoning] Rendering Reasoning component:", {
    hasBeenStreaming,
    estimatedDuration,
    isStreaming: isLoading,
    defaultOpen: hasBeenStreaming,
  });

  return (
    <Reasoning
      className={cn(className)}
      data-testid="message-reasoning"
      defaultOpen={hasBeenStreaming}
      estimatedDuration={estimatedDuration}
      isStreaming={isLoading}
    >
      <ReasoningTrigger />
      <ReasoningContent>{reasoning}</ReasoningContent>
    </Reasoning>
  );
}
