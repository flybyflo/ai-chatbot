"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Square } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Button } from "./ui/button";

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <Square size={14} />
    </Button>
  );
}

export const StopButton = memo(PureStopButton);
