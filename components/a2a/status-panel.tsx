"use client";

import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { A2ATaskStateBadge } from "./task-state-badge";

export function A2AStatusPanel({ className }: { className?: string }) {
  const { a2aRegistry, a2aSessions } = useDataStream();
  const [isExpanded, setIsExpanded] = useState(false);

  const agentCount = a2aRegistry
    ? Object.values(a2aRegistry.agents).filter((a) => a.isReady).length
    : 0;

  const allTasks = a2aSessions
    ? Object.values(a2aSessions).flatMap((session) =>
        Object.values(session.tasks)
      )
    : [];

  const activeTasks = allTasks.filter(
    (task) =>
      task.state?.toLowerCase() === "active" ||
      task.state?.toLowerCase() === "pending"
  );

  if (agentCount === 0 && allTasks.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        className="h-8 gap-2 px-2 md:h-fit md:px-2"
        onClick={() => setIsExpanded(!isExpanded)}
        variant="outline"
      >
        <Activity className="size-4 text-orange-500" />
        <span className="hidden md:inline">
          {agentCount > 0 &&
            `${agentCount} Agent${agentCount !== 1 ? "s" : ""}`}
          {agentCount > 0 && activeTasks.length > 0 && " • "}
          {activeTasks.length > 0 &&
            `${activeTasks.length} Task${activeTasks.length !== 1 ? "s" : ""}`}
        </span>
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>

      {isExpanded && (
        <>
          <button
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsExpanded(false);
              }
            }}
            type="button"
          />
          <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border bg-background p-4 shadow-lg">
            <div className="space-y-3">
              <div>
                <h3 className="mb-2 font-semibold text-sm">Active Agents</h3>
                {agentCount === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No agents active
                  </p>
                ) : (
                  <div className="space-y-1">
                    {a2aRegistry &&
                      Object.values(a2aRegistry.agents)
                        .filter((a) => a.isReady)
                        .map((agent) => (
                          <div
                            className="flex items-center justify-between rounded-md bg-muted/50 p-2"
                            key={agent.id}
                          >
                            <span className="font-medium text-sm">
                              {agent.displayName}
                            </span>
                            <span className="text-green-600 text-xs">
                              Ready
                            </span>
                          </div>
                        ))}
                  </div>
                )}
              </div>

              {allTasks.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-sm">Recent Tasks</h3>
                  <div className="space-y-1.5">
                    {allTasks.slice(0, 5).map((task) => {
                      const session = a2aSessions
                        ? Object.values(a2aSessions).find((s) =>
                            Object.keys(s.tasks).includes(task.taskId)
                          )
                        : undefined;
                      return (
                        <div
                          className="flex items-center justify-between rounded-md bg-muted/50 p-2"
                          key={task.taskId}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-xs">
                              {session?.agentName || "Unknown"} •{" "}
                              {task.taskId.slice(0, 8)}
                            </div>
                            {task.statusMessage && (
                              <div className="truncate text-muted-foreground text-xs">
                                {task.statusMessage}
                              </div>
                            )}
                          </div>
                          <A2ATaskStateBadge
                            className="ml-2 shrink-0"
                            state={task.state}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 border-t pt-3">
                <Button asChild className="flex-1" size="sm" variant="outline">
                  <Link href="/settings/a2a-tasks">View All Tasks</Link>
                </Button>
                <Button asChild className="flex-1" size="sm" variant="outline">
                  <Link href="/settings/a2a-events">View Events</Link>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
