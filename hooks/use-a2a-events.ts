"use client";

import { useEffect, useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import type { A2AToolEventPayload } from "@/lib/ai/a2a/types";

export function useA2AEvents() {
  const { a2aEventLog } = useDataStream();
  const events = useMemo(() => {
    if (!a2aEventLog) {
      console.log("[A2A-EVENTS-HOOK] No event log from provider");
      return [];
    }

    console.group("[A2A-EVENTS-HOOK] Events Retrieved");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Events count:", a2aEventLog.length);
    console.log(
      "Events:",
      a2aEventLog.map((e) => ({
        agentToolId: e.agentToolId,
        contextId: e.contextId,
        primaryTaskId: e.primaryTaskId,
        timestamp: e.timestamp,
      }))
    );
    console.groupEnd();

    return a2aEventLog;
  }, [a2aEventLog]);

  useEffect(() => {
    console.log("[A2A-EVENTS-HOOK] Events state updated:", {
      count: events.length,
      timestamp: new Date().toISOString(),
    });
  }, [events]);

  return events as A2AToolEventPayload[];
}
