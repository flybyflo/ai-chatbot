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
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setHasBeenStreaming(true);
    }
  }, [isLoading]);

  // Estimate duration based on reasoning content length
  // Rough estimate: ~50 characters per second of thinking
  const estimatedDuration = Math.max(1, Math.round(reasoning.length / 50));

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
