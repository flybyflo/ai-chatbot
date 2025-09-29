"use client";

import { ClipboardList, MessageCircle, Sparkles } from "lucide-react";
import type { A2AToolEventPayload } from "@/lib/ai/a2a/types";

export function MessageA2A({ event }: { event: A2AToolEventPayload }) {
  const summaryText =
    event.responseText?.trim() ||
    event.messages?.[event.messages.length - 1]?.text ||
    "(no textual response)";
  const tasks = event.tasks ?? [];
  const artifacts = event.artifacts ?? [];

  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-3xl rounded-xl border border-border/40 bg-muted/40 p-3 text-sm text-muted-foreground shadow-sm">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">
          <Sparkles className="size-3" />
          A2A Agent Response
        </div>
        <div className="text-foreground font-medium">
          {event.agentName}
          {event.contextId ? ` · Context ${event.contextId}` : ""}
        </div>

        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-border/30 bg-background/70 p-3">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">
              <ClipboardList className="size-3" /> Active Agent Tasks
            </div>
            {tasks.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No task lifecycle information reported.
              </div>
            ) : (
              <ul className="space-y-1 text-xs text-foreground">
                {tasks.map((task) => (
                  <li
                    className="rounded-md bg-muted/60 p-2"
                    key={`${event.agentToolId}-${task.taskId}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        Task {task.taskId}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {task.state ?? "unknown"}
                      </span>
                    </div>
                    {task.statusMessage ? (
                      <div className="mt-1 text-muted-foreground/80 text-[11px]">
                        {task.statusMessage}
                      </div>
                    ) : null}
                    {task.artifacts && task.artifacts.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {task.artifacts.map((artifact) => (
                          <li key={`${task.taskId}-${artifact.artifactId}`}>
                            {artifact.name ?? artifact.artifactId}
                            {artifact.description
                              ? ` — ${artifact.description}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border/30 bg-background/70 p-3">
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">
              <MessageCircle className="size-3" /> Recent Agent Activity
            </div>
            <div className="whitespace-pre-wrap text-sm text-foreground/80">
              {summaryText}
            </div>
            {artifacts.length > 0 ? (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Produced {artifacts.length} artifact
                {artifacts.length === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageA2A;
