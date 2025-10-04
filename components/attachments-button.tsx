"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Paperclip } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Button } from "./ui/button";

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <Paperclip size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

export const AttachmentsButton = memo(PureAttachmentsButton);
