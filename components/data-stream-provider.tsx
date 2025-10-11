"use client";

import type { DataUIPart } from "ai";
import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type {
  A2AAgentRegistry,
  A2AEventLogEntry,
  A2ASessionSnapshot,
  A2ATaskSummary,
  A2AToolEventPayload,
} from "@/lib/ai/a2a/types";
import type { MCPToolRegistry } from "@/lib/ai/mcp/types";
import type { CustomUIDataTypes } from "@/lib/types";

type DataStreamContextValue = {
  dataStream: DataUIPart<CustomUIDataTypes>[];
  setDataStream: React.Dispatch<
    React.SetStateAction<DataUIPart<CustomUIDataTypes>[]>
  >;
  mcpRegistry?: MCPToolRegistry;
  a2aRegistry?: A2AAgentRegistry;
  a2aSessions?: Record<string, A2ASessionSnapshot>;
  a2aEventLog?: A2AEventLogEntry[];
};

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataStream, setDataStream] = useState<DataUIPart<CustomUIDataTypes>[]>(
    []
  );

  const mcpRegistry = useMemo(() => {
    const mcpData = dataStream.find((part) => {
      const type = part.type as string;
      return type === "data-mcpRegistry" || type === "data-mcp-registry";
    });
    return mcpData?.data as MCPToolRegistry | undefined;
  }, [dataStream]);

  const a2aRegistry = useMemo(() => {
    const a2aData = dataStream.find((part) => {
      const type = part.type as string;
      return type === "data-a2aRegistry" || type === "data-a2a-registry";
    });
    return a2aData?.data as A2AAgentRegistry | undefined;
  }, [dataStream]);

  const a2aEventParts = useMemo(() => {
    const events = dataStream.filter((part) => {
      const type = part.type as string;
      return type === "data-a2aEvents" || type === "data-a2a-events";
    });

    if (events.length > 0) {
      console.group("[A2A-PROVIDER] Stream A2A Events Extracted");
      console.log("Events count:", events.length);
      console.log(
        "Events:",
        events.map((event) => ({
          agentToolId: (event.data as any)?.agentToolId,
          contextId: (event.data as any)?.contextId,
          primaryTaskId: (event.data as any)?.primaryTaskId,
          timestamp: (event.data as any)?.timestamp,
        }))
      );
      console.groupEnd();
    }

    return events;
  }, [dataStream]);

  const a2aSessions = useMemo(() => {
    if (a2aEventParts.length === 0) {
      return;
    }

    const sessions: Record<string, A2ASessionSnapshot> = {};

    console.group("[A2A-PROVIDER] Building Stream Sessions");
    console.log("Processing events:", a2aEventParts.length);

    for (const part of a2aEventParts) {
      const payload = part.data as A2AToolEventPayload | undefined;
      if (!payload) {
        continue;
      }

      const sessionKey = payload.contextId ?? payload.agentToolId;
      const existing = sessions[sessionKey];

      console.log("[A2A-PROVIDER] Processing event for session:", sessionKey, {
        agentToolId: payload.agentToolId,
        contextId: payload.contextId,
        primaryTaskId: payload.primaryTaskId,
        timestamp: payload.timestamp,
        existingSession: !!existing,
      });

      const payloadTasks = Array.isArray(payload.tasks)
        ? payload.tasks
        : ([] as A2ATaskSummary[]);
      const nextTasks = payloadTasks.reduce<Record<string, A2ATaskSummary>>(
        (acc, task) => {
          if (task?.taskId) {
            acc[task.taskId] = task;
          }
          return acc;
        },
        existing ? { ...existing.tasks } : {}
      );

      const payloadMessages = Array.isArray(payload.messages)
        ? payload.messages
        : [];
      const combinedMessages = [
        ...(existing?.messages ?? []),
        ...payloadMessages,
      ];
      const seenMessageKeys = new Set<string>();
      const dedupedMessages = combinedMessages.filter((message, index) => {
        const key =
          message?.messageId ||
          `${message?.taskId ?? ""}:${message?.role ?? ""}:${
            message?.text ?? ""
          }:${index}`;
        if (seenMessageKeys.has(key)) {
          return false;
        }
        seenMessageKeys.add(key);
        return true;
      });

      sessions[sessionKey] = {
        agentKey: payload.agentKey,
        agentId: payload.agentId,
        agentToolId: payload.agentToolId,
        agentName: payload.agentName,
        contextId: payload.contextId ?? existing?.contextId,
        primaryTaskId: payload.primaryTaskId ?? existing?.primaryTaskId,
        lastUpdated: payload.timestamp ?? existing?.lastUpdated,
        tasks: nextTasks,
        messages: dedupedMessages,
        lastResponseText: payload.responseText ?? existing?.lastResponseText,
      };
    }

    console.log("Total sessions created:", Object.keys(sessions).length);
    console.groupEnd();

    return Object.keys(sessions).length > 0 ? sessions : undefined;
  }, [a2aEventParts]);

  const a2aEventLog = useMemo(() => {
    if (a2aEventParts.length === 0) {
      return;
    }

    const combined: A2AEventLogEntry[] = [];
    const seenUnique = new Set<string>();

    for (const part of a2aEventParts) {
      const payload = part.data as A2AToolEventPayload | undefined;
      if (!payload) {
        continue;
      }

      const lastMessage = payload.messages?.at(-1);
      const uniqueKey = [
        payload.agentToolId ?? payload.agentKey ?? "unknown",
        payload.primaryTaskId ?? "",
        payload.contextId ?? "",
        lastMessage?.messageId ?? "",
        payload.responseText?.trim() ?? "",
      ]
        .join(":")
        .toLowerCase();

      if (seenUnique.has(uniqueKey)) {
        console.log("[A2A-PROVIDER] Skipping duplicate stream event:", {
          uniqueKey: uniqueKey.substring(0, 100),
          agentToolId: payload.agentToolId,
        });
        continue;
      }

      seenUnique.add(uniqueKey);
      combined.push(payload);
    }

    combined.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    console.log("[A2A-PROVIDER] Final stream event log count:", combined.length);

    return combined.length > 0 ? combined : undefined;
  }, [a2aEventParts]);

  const value = useMemo(
    () => ({
      dataStream,
      setDataStream,
      mcpRegistry,
      a2aRegistry,
      a2aSessions,
      a2aEventLog,
    }),
    [dataStream, mcpRegistry, a2aRegistry, a2aSessions, a2aEventLog]
  );

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error("useDataStream must be used within a DataStreamProvider");
  }
  return context;
}
