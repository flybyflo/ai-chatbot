"use client";

import { useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import type { A2AToolEventPayload } from "@/lib/ai/a2a/types";

export function useA2AEvents() {
  const { a2aEventLog } = useDataStream();
  const events = useMemo(() => {
    if (!a2aEventLog) {
      return [];
    }
    return a2aEventLog;
  }, [a2aEventLog]);

  return events as A2AToolEventPayload[];
}
