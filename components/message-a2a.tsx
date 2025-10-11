"use client";

import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ImageIcon,
  type LucideIcon,
  MessageCircle,
  SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import type { A2ATaskSummary, A2AToolEventPayload } from "@/lib/ai/a2a/types";

const START_CHAR_REGEX = /^./;

const URL_REGEX = /https?:\/\/[^\s)]+/gi;

function formatStateLabel(value: string | undefined, fallback = "update") {
  return (value || fallback)
    .replaceAll("_", " ")
    .replace(START_CHAR_REGEX, (character) => character.toUpperCase());
}

function normalizeText(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function formatTimestamp(value: string | undefined) {
  if (!value) {
    return;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return;
  }
  return date.toLocaleTimeString();
}

function extractUrls(value: string | undefined | null) {
  if (!value) {
    return [] as string[];
  }
  const matches = value.match(URL_REGEX) ?? [];
  const cleaned = matches
    .map((match) => match.replace(/[.,)]+$/g, ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function getStatusIcon(label: string, state?: string) {
  const normalizedState = normalizeText(state);
  if (
    normalizedState.includes("error") ||
    normalizedState.includes("fail") ||
    normalizedState.includes("cancel")
  ) {
    return CircleAlert;
  }
  if (
    normalizedState.includes("complete") ||
    normalizedState.includes("success") ||
    normalizedState.includes("done")
  ) {
    return CheckCircle2;
  }

  const normalizedLabel = normalizeText(label);
  if (
    normalizedLabel.includes("search") ||
    normalizedLabel.includes("fetch") ||
    normalizedLabel.includes("scrap")
  ) {
    return SearchIcon;
  }
  if (normalizedLabel.includes("image")) {
    return ImageIcon;
  }

  return MessageCircle;
}

function getTaskProgress(state: string | undefined) {
  if (!state) {
    return "pending" as const;
  }
  const normalized = normalizeText(state);
  if (
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized.includes("done") ||
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("cancel")
  ) {
    return "complete" as const;
  }
  return "pending" as const;
}

function getTaskIcon(state: string | undefined) {
  const progress = getTaskProgress(state);
  if (progress === "pending") {
    return CircleDashed;
  }
  if (state && normalizeText(state).includes("error")) {
    return CircleAlert;
  }
  return CheckCircle2;
}

type Step = {
  key: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  urls?: string[];
  progress?: "complete" | "pending";
};

const AUTO_CLOSE_DELAY = 500;

export default function MessageA2ATimeline({
  event,
  tasks,
  enableAnimation = true,
  isStreaming = false,
}: {
  event: A2AToolEventPayload;
  tasks?: A2ATaskSummary[];
  enableAnimation?: boolean;
  isStreaming?: boolean;
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
  const normalizedMessages = useMemo(
    () =>
      (event.messages ?? [])
        .map((message) => normalizeText(message?.text))
        .filter(Boolean),
    [event.messages]
  );
  const shouldShowResponse =
    summaryText && normalizedSummary !== normalizeText(latestStatusMessage);

  const summaryInMessages = normalizedMessages.includes(normalizedSummary);

  // Flattened, animated step data
  const steps = useMemo(() => {
    const result: Step[] = [];
    const seenLabels = new Set<string>();

    const pushStep = (step: Step) => {
      if (!step.label) {
        return;
      }
      const normalizedLabel = normalizeText(step.label);
      const normalizedDescription = normalizeText(step.description);
      const dedupeKey = `${normalizedLabel}|${normalizedDescription}`.trim();
      if (dedupeKey && seenLabels.has(dedupeKey)) {
        return;
      }
      if (dedupeKey) {
        seenLabels.add(dedupeKey);
      }
      result.push(step);
    };

    pushStep({
      key: "call",
      label: `Subagent ${event.agentName ?? "agent"} asked for help`,
      description: formatTimestamp(event.timestamp),
      icon: SearchIcon,
      progress: "complete",
    });

    for (const [index, update] of statusUpdates.entries()) {
      const message = update?.message?.trim();
      const label = message || formatStateLabel(update?.state);
      if (!label) {
        continue;
      }
      const metadata = [
        update?.contextId
          ? `Context ${update.contextId.slice(0, 8)}…`
          : undefined,
        update?.state ? formatStateLabel(update.state) : undefined,
        formatTimestamp(update?.timestamp),
      ]
        .filter(Boolean)
        .join(" • ")
        .trim();

      pushStep({
        key: `status-${index}-${update?.taskId ?? "none"}`,
        label,
        description: metadata || undefined,
        icon: getStatusIcon(label, update?.state),
        urls: extractUrls(message),
        progress: getTaskProgress(update?.state),
      });
    }

    for (const task of dedupedTasks) {
      const descriptionParts = [
        task.state
          ? `State: ${formatStateLabel(task.state, "unknown")}`
          : undefined,
        task.statusMessage &&
        normalizeText(task.statusMessage) !== normalizedSummary
          ? task.statusMessage
          : undefined,
      ]
        .filter(Boolean)
        .join("\n\n");

      pushStep({
        key: `task-${task.taskId}`,
        label: `Task ${task.taskId.slice(0, 8)}…`,
        description: descriptionParts || undefined,
        icon: getTaskIcon(task.state),
        urls: extractUrls(task.statusMessage),
        progress: getTaskProgress(task.state),
      });
    }

    if (shouldShowResponse && !summaryInMessages) {
      pushStep({
        key: "response",
        label: summaryText,
        description: event.agentName
          ? `Answer from ${event.agentName}`
          : "Agent response",
        icon: CheckCircle2,
        urls: extractUrls(summaryText),
        progress: "complete",
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
    summaryInMessages,
    summaryText,
  ]);

  const [visibleCount, setVisibleCount] = useState(() =>
    enableAnimation ? Math.min(steps.length, 1) : steps.length
  );

  const visibleSteps = useMemo(
    () => steps.slice(0, visibleCount),
    [steps, visibleCount]
  );

  const [isOpen, setIsOpen] = useState(isStreaming);
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isStreaming);
  const [hasAutoClosed, setHasAutoClosed] = useState(false);

  useEffect(() => {
    if (isStreaming) {
      setHasBeenStreaming(true);
      setHasAutoClosed(false);
      setIsOpen(true);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (
      !isStreaming &&
      hasBeenStreaming &&
      isOpen &&
      !hasAutoClosed
    ) {
      const timeout = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timeout);
    }
  }, [hasAutoClosed, hasBeenStreaming, isOpen, isStreaming]);

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
    <section aria-live="polite" className="relative w-full p-0">
      <ChainOfThought
        className="w-full rounded-none border-0 bg-transparent p-0 shadow-none"
        onOpenChange={setIsOpen}
        open={isOpen}
        isStreaming={isStreaming}
      >
        <ChainOfThoughtHeader>
          {event.agentName
            ? `${event.agentName} · Chain of Thought`
            : "Chain of Thought"}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent className="w-full">
          {visibleSteps.map((step, index) => {
            const isLastVisible = index === visibleSteps.length - 1;
            let status: "complete" | "active" | "pending" =
              step.progress ?? "complete";

            if (isLastVisible) {
              status =
                visibleCount === steps.length && status === "complete"
                  ? "complete"
                  : "active";
            }

            return (
              <ChainOfThoughtStep
                description={step.description}
                icon={step.icon ?? MessageCircle}
                key={step.key}
                label={step.label}
                status={status}
              >
                {step.urls && step.urls.length > 0 && (
                  <ChainOfThoughtSearchResults>
                    {step.urls.map((url) => {
                      try {
                        const parsed = new URL(url);
                        const hostname = parsed.hostname;
                        return (
                          <ChainOfThoughtSearchResult key={url}>
                            {hostname}
                          </ChainOfThoughtSearchResult>
                        );
                      } catch (_error) {
                        return (
                          <ChainOfThoughtSearchResult key={url}>
                            {url}
                          </ChainOfThoughtSearchResult>
                        );
                      }
                    })}
                  </ChainOfThoughtSearchResults>
                )}
              </ChainOfThoughtStep>
            );
          })}
        </ChainOfThoughtContent>
      </ChainOfThought>
    </section>
  );
}
