"use client";

import { Calendar, ChevronDown, ChevronRight, FileBox } from "lucide-react";
import { useMemo, useState } from "react";
import { A2ATaskStateBadge } from "@/components/a2a";
import { useDataStream } from "@/components/data-stream-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { A2ATaskSummary } from "@/lib/ai/a2a/types";

type TaskWithAgent = A2ATaskSummary & {
  agentName: string;
  agentId: string;
};

export default function A2ATasksPage() {
  const { a2aSessions } = useDataStream();
  const [filterState, setFilterState] = useState<string>("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const { tasks, agentNames } = useMemo(() => {
    if (!a2aSessions) {
      return { tasks: [], agentNames: [] };
    }

    const tasksList: TaskWithAgent[] = [];
    const agentSet = new Set<string>();

    for (const session of Object.values(a2aSessions)) {
      agentSet.add(session.agentName);
      for (const task of Object.values(session.tasks)) {
        tasksList.push({
          ...task,
          agentName: session.agentName,
          agentId: session.agentId,
        });
      }
    }

    return {
      tasks: tasksList.sort((a, b) => {
        const timeA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const timeB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return timeB - timeA;
      }),
      agentNames: Array.from(agentSet).sort(),
    };
  }, [a2aSessions]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (filterState !== "all") {
      result = result.filter(
        (task) => task.state?.toLowerCase() === filterState.toLowerCase()
      );
    }

    if (filterAgent !== "all") {
      result = result.filter((task) => task.agentName === filterAgent);
    }

    return result;
  }, [tasks, filterState, filterAgent]);

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">A2A Task Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor task execution and artifacts across all agents.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Select onValueChange={setFilterState} value={filterState}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={setFilterAgent} value={filterAgent}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agentNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="font-semibold text-foreground">No tasks found</p>
            <p className="text-muted-foreground text-sm">
              {tasks.length === 0
                ? "Tasks will appear here when A2A agents are active"
                : "Try adjusting your filters"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isExpanded = expandedTasks.has(task.taskId);
            const hasArtifacts = task.artifacts && task.artifacts.length > 0;

            return (
              <div
                className="rounded-lg border bg-card transition-colors hover:bg-muted/30"
                key={task.taskId}
              >
                <button
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => toggleTask(task.taskId)}
                  type="button"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-orange-600 text-sm">
                          {task.agentName}
                        </span>
                        <span className="text-muted-foreground text-xs">•</span>
                        <span className="truncate font-mono text-foreground/70 text-xs">
                          {task.taskId}
                        </span>
                      </div>
                      {task.statusMessage && (
                        <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
                          {task.statusMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {hasArtifacts && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <FileBox className="size-3" />
                        {task.artifacts?.length}
                      </span>
                    )}
                    {task.lastUpdated && (
                      <span className="hidden text-muted-foreground text-xs sm:flex">
                        <Calendar className="mr-1 size-3" />
                        {new Date(task.lastUpdated).toLocaleString()}
                      </span>
                    )}
                    <A2ATaskStateBadge state={task.state} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t bg-muted/20 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="font-medium text-foreground/70 text-xs">
                          Agent
                        </div>
                        <div className="mt-1 text-sm">{task.agentName}</div>
                      </div>
                      <div>
                        <div className="font-medium text-foreground/70 text-xs">
                          Task ID
                        </div>
                        <div className="mt-1 font-mono text-sm">
                          {task.taskId}
                        </div>
                      </div>
                      {task.contextId && (
                        <div>
                          <div className="font-medium text-foreground/70 text-xs">
                            Context ID
                          </div>
                          <div className="mt-1 font-mono text-sm">
                            {task.contextId}
                          </div>
                        </div>
                      )}
                      {task.lastUpdated && (
                        <div>
                          <div className="font-medium text-foreground/70 text-xs">
                            Last Updated
                          </div>
                          <div className="mt-1 text-sm">
                            {new Date(task.lastUpdated).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {task.statusMessage && (
                      <div>
                        <div className="font-medium text-foreground/70 text-xs">
                          Status Message
                        </div>
                        <div className="mt-1 rounded-md bg-background p-3 text-sm">
                          {task.statusMessage}
                        </div>
                      </div>
                    )}

                    {hasArtifacts && (
                      <div>
                        <div className="mb-2 font-medium text-foreground/70 text-xs">
                          Artifacts ({task.artifacts?.length})
                        </div>
                        <div className="space-y-2">
                          {task.artifacts?.map((artifact) => (
                            <div
                              className="flex items-start gap-2 rounded-md bg-background p-3"
                              key={artifact.artifactId}
                            >
                              <FileBox className="mt-0.5 size-4 shrink-0 text-orange-500" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm">
                                  {artifact.name || artifact.artifactId}
                                </div>
                                {artifact.description && (
                                  <div className="mt-1 text-muted-foreground text-xs">
                                    {artifact.description}
                                  </div>
                                )}
                                <div className="mt-1 font-mono text-muted-foreground text-xs">
                                  ID: {artifact.artifactId}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
