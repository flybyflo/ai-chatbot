"use client";

import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function A2AJsonViewer({
  data,
  className,
  defaultExpanded = false,
}: {
  data: unknown;
  className?: string;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className={cn("rounded-lg border bg-muted/30", className)}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <button
          className="flex items-center gap-1 font-medium text-foreground/70 text-sm hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {isExpanded ? "Hide" : "Show"} JSON
        </button>
        <Button
          onClick={handleCopy}
          size="sm"
          variant="ghost"
        >
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      {isExpanded && (
        <pre className="overflow-x-auto p-3 font-mono text-foreground/80 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
