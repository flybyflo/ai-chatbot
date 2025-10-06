"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  MessageCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { A2ATaskSummary, A2AToolEventPayload } from "@/lib/ai/a2a/types";

const START_CHAR_REGEX = /^./;

function formatStateLabel(value: string | undefined, fallback = "update") {
  return (value || fallback)
    .replaceAll("_", " ")
    .replace(START_CHAR_REGEX, (character) => character.toUpperCase());
}

function normalizeText(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isTerminalState(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "input_required" ||
    normalized === "unknown"
  );
}

type TimelineStep = {
  key: string;
  title: string;
  meta?: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "pending";
};

/**
 * A clean, modern, headerless timeline for A2A events.
 * - No cards; just a vertical timeline.
 * - Steps animate in as they're added.
 * - Uses Tailwind + Framer Motion.
 */
export default function MessageA2ATimeline({
  event,
  tasks,
  enableAnimation = true,
}: {
  event: A2AToolEventPayload;
  tasks?: A2ATaskSummary[];
  enableAnimation?: boolean;
}) {
  const summaryText =
    event.responseText?.trim() ||
    event.messages?.at(-1)?.text?.trim() ||
    event.statusUpdates?.at(-1)?.message?.trim() ||
    "(no response)";

  // Dedupe tasks by id (event.tasks or provided prop)
  const dedupedTasks = useMemo(() => {
    const sourceTasks = (tasks ?? event.tasks ?? []).filter(Boolean);
    if (sourceTasks.length === 0) {
      return [] as A2ATaskSummary[];
    }
    const map = new Map<string, A2ATaskSummary>();
    for (const task of sourceTasks) {
      if (!task?.taskId) {
        continue;
      }
      map.set(task.taskId, task);
    }
    return Array.from(map.values());
  }, [tasks, event.tasks]);

  const statusUpdates = event.statusUpdates ?? [];
  const latestStatus = statusUpdates.at(-1);
  const latestStatusMessage = latestStatus?.message?.trim();
  const normalizedSummary = normalizeText(summaryText);
  const shouldShowResponse =
    summaryText && normalizedSummary !== normalizeText(latestStatusMessage);

  // Flattened, animated step data
  const steps = useMemo(() => {
    const interimStatuses: TimelineStep[] = [];
    const terminalStatuses: TimelineStep[] = [];
    const result: TimelineStep[] = [];

    result.push({
      key: "call",
      title: `Subagent ${event.agentName ?? "agent"} asked for help`,
      meta: event.timestamp
        ? new Date(event.timestamp).toLocaleTimeString()
        : undefined,
      tone: "info",
    });

    for (const [index, update] of statusUpdates.entries()) {
      const stateLabel = formatStateLabel(update?.state);
      const step: TimelineStep = {
        key: `status-${index}-${update?.taskId ?? "none"}`,
        title: stateLabel,
        meta: update?.contextId
          ? `Context ${update.contextId.slice(0, 8)}…`
          : undefined,
        description: update?.message || "Awaiting details",
        tone: update?.state?.toLowerCase().includes("error")
          ? "warning"
          : update?.state?.toLowerCase().includes("complete")
            ? "success"
            : "pending",
      };

      if (isTerminalState(update?.state)) {
        terminalStatuses.push(step);
      } else {
        interimStatuses.push(step);
      }
    }

    result.push(...interimStatuses);

    for (const task of dedupedTasks) {
      const stateLabel = formatStateLabel(task.state, "unknown");
      const showTaskMessage =
        !!task.statusMessage &&
        normalizeText(task.statusMessage) !== normalizedSummary;
      result.push({
        key: `task-${task.taskId}`,
        title: `Task ${task.taskId.slice(0, 8)}…`,
        meta: stateLabel,
        description: showTaskMessage ? task.statusMessage : undefined,
        tone: task.state?.toLowerCase().includes("complete")
          ? "success"
          : task.state?.toLowerCase().includes("error")
            ? "warning"
            : "pending",
      });
    }

    result.push(...terminalStatuses);

    if (shouldShowResponse) {
      result.push({
        key: "response",
        title: "Agent Response",
        description: summaryText,
        tone: "info",
      });
    }

    return result;
  }, [
    dedupedTasks,
    event.agentName,
    event.timestamp,
    normalizedSummary,
    shouldShowResponse,
    statusUpdates,
    summaryText,
  ]);

  const [visibleCount, setVisibleCount] = useState(() =>
    enableAnimation ? Math.min(steps.length, 1) : steps.length
  );

  const visibleSteps = useMemo(
    () => steps.slice(0, visibleCount),
    [steps, visibleCount]
  );

  useEffect(() => {
    setVisibleCount((prev) => {
      if (steps.length === 0) {
        return 0;
      }
      if (!enableAnimation) {
        return steps.length;
      }
      if (prev === 0) {
        return 1;
      }
      if (prev > steps.length) {
        return steps.length;
      }
      return prev;
    });
  }, [steps.length, enableAnimation]);

  useEffect(() => {
    if (!enableAnimation) {
      return;
    }
    if (visibleCount >= steps.length) {
      return;
    }
    const timeout = setTimeout(() => {
      setVisibleCount((prev) => {
        if (steps.length === 0) {
          return 0;
        }
        const next = prev + 1;
        return next > steps.length ? steps.length : next;
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [visibleCount, steps.length, enableAnimation]);

  return (
    <section aria-live="polite" className="relative w-full p-2 sm:p-4">
      {/* Timeline rail */}
      <div className="relative pl-3 sm:pl-4">
        <motion.span
          animate={{ scaleY: 1 }}
          aria-hidden
          className="pointer-events-none absolute top-3 h-[calc(100%-0.75rem)] w-px origin-top bg-border/70"
          initial={{ scaleY: 0 }}
          style={{ left: "-2.5px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Steps */}
        <ol className="space-y-6">
          <AnimatePresence initial={false}>
            {visibleSteps.map((step, index) => {
              const isLast = index === visibleSteps.length - 1;
              const delay = index * 0.08;

              return (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  className="relative"
                  exit={{ opacity: 0, y: -6 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={step.key}
                  layout
                  transition={{ duration: 0.35, ease: "easeOut", delay }}
                >
                  {/* Content */}
                  <div className="relative ml-2">
                    {/* Dot / icon */}
                    <div className="-left-9 sm:-left-10 -translate-y-1/2 absolute top-1/2 flex items-center justify-center">
                      <Dot
                        isActive={isLast && visibleCount === steps.length}
                        tone={step.tone}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium text-foreground/90 text-sm sm:text-[0.95rem]">
                        {step.title}
                      </h4>
                      {step.meta && (
                        <span className="text-[11px] text-muted-foreground/80 uppercase tracking-wide">
                          {step.meta}
                        </span>
                      )}
                    </div>

                    {step.description && (
                      <motion.p
                        animate={{ opacity: 1 }}
                        className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm"
                        initial={{ opacity: 0 }}
                        transition={{
                          duration: 0.35,
                          ease: "easeOut",
                          delay: delay + 0.05,
                        }}
                      >
                        {step.description}
                      </motion.p>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </div>
    </section>
  );
}

function Dot({
  tone = "info",
  isActive = false,
}: {
  tone?: "info" | "success" | "warning" | "pending";
  isActive?: boolean;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? CircleAlert
        : tone === "pending"
          ? CircleDashed
          : MessageCircle;

  return (
    <div className="relative">
      {/* outer ring */}
      <span className="absolute inset-0 rounded-full bg-foreground/5 blur-[1.5px]" />

      {/* pulse on the latest item */}
      {isActive && (
        <span className="absolute inset-0 animate-ping rounded-full bg-foreground/20" />
      )}

      <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
        <Icon className="h-3.5 w-3.5 text-foreground/80" />
      </span>
    </div>
  );
}
