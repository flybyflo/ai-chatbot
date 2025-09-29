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

  // Extract MCP registry from data stream
  const mcpRegistry = useMemo(() => {
    const mcpData = dataStream.find(
      (part) =>
        part.type === "data-mcpRegistry" || part.type === "data-mcp-registry"
    );
    return mcpData?.data as MCPToolRegistry | undefined;
  }, [dataStream]);

  const a2aRegistry = useMemo(() => {
    const a2aData = dataStream.find(
      (part) =>
        part.type === "data-a2aRegistry" || part.type === "data-a2a-registry"
    );
    return a2aData?.data as A2AAgentRegistry | undefined;
  }, [dataStream]);

  const a2aEvents = useMemo(() => {
    return dataStream.filter(
      (part) =>
        part.type === "data-a2aEvents" || part.type === "data-a2a-events"
    );
  }, [dataStream]);

  const a2aSessions = useMemo(() => {
    const sessions: Record<string, A2ASessionSnapshot> = {};

    for (const part of a2aEvents) {
      const payload = part.data as A2AToolEventPayload | undefined;
      if (!payload) {
        continue;
      }

      const sessionKey = payload.contextId ?? payload.agentToolId;
      const existing = sessions[sessionKey];

      const payloadTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      const nextTasks = payloadTasks.reduce<Record<string, A2ATaskSummary>>(
        (acc, task) => {
          acc[task.taskId] = task;
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
          message.messageId ||
          `${message.taskId ?? ""}:${message.role ?? ""}:${
            message.text ?? ""
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

    return sessions;
  }, [a2aEvents]);

  const a2aEventLog = useMemo(() => {
    const entries: A2AEventLogEntry[] = [];
    for (const part of a2aEvents) {
      const payload = part.data as A2AToolEventPayload | undefined;
      if (!payload) {
        continue;
      }
      entries.push(payload);
    }
    return entries.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [a2aEvents]);

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
