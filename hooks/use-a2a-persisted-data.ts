"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type {
  A2AAgentRegistry,
  A2AEventLogEntry,
  A2ASessionSnapshot,
} from "@/lib/ai/a2a/types";

export function useA2APersistedData(chatId?: string) {
  const queryArgs = chatId ? { chatId } : {};
  const data = useQuery(api.queries.getA2AData, queryArgs as any);

  const registry = (data?.registry ?? null) as A2AAgentRegistry | null;

  const sessionsByKey = useMemo(() => {
    if (!data?.sessions) {
      return;
    }

    const map: Record<string, A2ASessionSnapshot> = {};

    for (const entry of data.sessions) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { sessionKey?: unknown }).sessionKey === "string" &&
        (entry as { snapshot?: unknown }).snapshot
      ) {
        const sessionKey = (entry as { sessionKey: string }).sessionKey;
        const snapshot = (entry as { snapshot: A2ASessionSnapshot }).snapshot;
        map[sessionKey] = snapshot;
      }
    }

    return Object.keys(map).length > 0 ? map : undefined;
  }, [data?.sessions]);

  const eventLog = useMemo(() => {
    if (!data?.events) {
      return;
    }

    const sourceEvents = Array.isArray(data.events)
      ? (data.events as A2AEventLogEntry[])
      : [];

    if (sourceEvents.length === 0) {
      return;
    }

    const deduped: A2AEventLogEntry[] = [];
    const seen = new Set<string>();

    for (const event of sourceEvents) {
      if (!event) {
        continue;
      }
      const key = [
        event.agentToolId ?? event.agentKey ?? "unknown",
        event.contextId ?? "",
        event.primaryTaskId ?? "",
        event.timestamp ?? "",
        event.responseText ?? "",
      ]
        .join(":")
        .toLowerCase();

      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(event);
    }

    if (deduped.length === 0) {
      return;
    }

    deduped.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    return deduped;
  }, [data?.events]);

  return {
    registry: registry ?? undefined,
    sessionsByKey,
    eventLog,
    isLoading: data === undefined,
  };
}
