"use client";

import { Progress } from "@/components/ui/progress";
import type { MCPProgressNotification } from "@/lib/ai/mcp/progress-types";

type MCPProgressIndicatorProps = {
  progress: MCPProgressNotification;
  className?: string;
};

export function MCPProgressIndicator({
  progress,
  className = "",
}: MCPProgressIndicatorProps) {
  const { progress: current, total, message } = progress;

  // Calculate percentage for determinate progress
  const percentage = total ? Math.round((current / total) * 100) : undefined;

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <div className="size-3 animate-pulse rounded-full bg-blue-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground text-sm">
              {message || "Processing..."}
            </h3>
            {percentage !== undefined && (
              <span className="text-muted-foreground text-xs">
                {percentage}%
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {total
              ? `${current} of ${total} items`
              : `${current} items processed`}
          </p>
        </div>
      </div>

      <div className="w-full">
        {total ? (
          <Progress className="h-2" value={percentage} />
        ) : (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}

type MCPProgressContainerProps = {
  progressStates: Map<string, MCPProgressNotification>;
  className?: string;
};

export function MCPProgressContainer({
  progressStates,
  className = "",
}: MCPProgressContainerProps) {
  if (progressStates.size === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="font-medium text-muted-foreground text-sm">
        Active Operations ({progressStates.size})
      </div>
      {Array.from(progressStates.values()).map((progress, index) => (
        <MCPProgressIndicator
          key={progress.progressToken || index}
          progress={progress}
        />
      ))}
    </div>
  );
}
