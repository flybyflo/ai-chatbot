"use client";

import { ChevronDown, ChevronRight, FileBox } from "lucide-react";
import { useState } from "react";
import type { A2ATaskSummary } from "@/lib/ai/a2a/types";
import { cn } from "@/lib/utils";
import { A2ATaskStateBadge } from "./task-state-badge";

export function A2ATaskProgress({
  task,
  agentName,
  className,
}: {
  task: A2ATaskSummary;
  agentName?: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasArtifacts = task.artifacts && task.artifacts.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-900/30 dark:bg-orange-950/20",
        className
      )}
    >
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            {agentName && <span className="text-orange-600">{agentName}</span>}
            {agentName && " • "}
            Task {task.taskId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasArtifacts && (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <FileBox className="size-3" />
              {task.artifacts?.length}
            </span>
          )}
          <A2ATaskStateBadge state={task.state} />
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-orange-200 pt-3 dark:border-orange-900/30">
          {task.statusMessage && (
            <div className="text-foreground/80 text-sm">
              {task.statusMessage}
            </div>
          )}

          {task.contextId && (
            <div className="font-mono text-muted-foreground text-xs">
              Context: {task.contextId}
            </div>
          )}

          {hasArtifacts && (
            <div className="space-y-1.5">
              <div className="font-medium text-xs text-foreground/70">
                Artifacts:
              </div>
              <ul className="space-y-1">
                {task.artifacts?.map((artifact) => (
                  <li
                    className="flex items-start gap-2 text-sm"
                    key={artifact.artifactId}
                  >
                    <FileBox className="mt-0.5 size-3 text-orange-500" />
                    <div>
                      <div className="font-medium">
                        {artifact.name || artifact.artifactId}
                      </div>
                      {artifact.description && (
                        <div className="text-muted-foreground text-xs">
                          {artifact.description}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.lastUpdated && (
            <div className="text-muted-foreground text-xs">
              Updated: {new Date(task.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
