"use client";

import type { DataUIPart } from "ai";
import { useQuery } from "convex/react";
import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
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
    const mcpData = dataStream.find((part) => {
      const type = part.type as string;
      return type === "data-mcpRegistry" || type === "data-mcp-registry";
    });
    return mcpData?.data as MCPToolRegistry | undefined;
  }, [dataStream]);

  const streamA2ARegistry = useMemo(() => {
    const a2aData = dataStream.find((part) => {
      const type = part.type as string;
      return type === "data-a2aRegistry" || type === "data-a2a-registry";
    });
    return a2aData?.data as A2AAgentRegistry | undefined;
  }, [dataStream]);

  const streamA2AEvents = useMemo(() => {
    return dataStream.filter((part) => {
      const type = part.type as string;
      return type === "data-a2aEvents" || type === "data-a2a-events";
    });
  }, [dataStream]);

  const streamA2ASessions = useMemo(() => {
    const sessions: Record<string, A2ASessionSnapshot> = {};

    for (const part of streamA2AEvents) {
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
  }, [streamA2AEvents]);

  const streamA2AEventLog = useMemo(() => {
    const entries: A2AEventLogEntry[] = [];
    for (const part of streamA2AEvents) {
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
  }, [streamA2AEvents]);

  const persistedA2A = useQuery(api.queries.getA2AData, {});

  const persistedRegistry =
    persistedA2A?.registry && typeof persistedA2A.registry === "object"
      ? (persistedA2A.registry as A2AAgentRegistry)
      : undefined;

  const persistedSessions = useMemo(() => {
    if (!persistedA2A?.sessions) {
      return;
    }

    const result: Record<string, A2ASessionSnapshot> = {};
    for (const entry of persistedA2A.sessions) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.sessionKey === "string" &&
        entry.snapshot
      ) {
        result[entry.sessionKey] = entry.snapshot as A2ASessionSnapshot;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }, [persistedA2A]);

  const persistedEventLog = useMemo(() => {
    if (!persistedA2A?.events) {
      return;
    }
    return (persistedA2A.events as A2AEventLogEntry[]) ?? [];
  }, [persistedA2A]);

  const resolvedA2ARegistry =
    streamA2ARegistry ?? persistedRegistry ?? undefined;

  const resolvedA2ASessions = useMemo(() => {
    const combined: Record<string, A2ASessionSnapshot> = {};
    if (persistedSessions) {
      Object.assign(combined, persistedSessions);
    }
    if (streamA2ASessions) {
      Object.assign(combined, streamA2ASessions);
    }
    return Object.keys(combined).length > 0 ? combined : undefined;
  }, [persistedSessions, streamA2ASessions]);

  const resolvedA2AEventLog = useMemo(() => {
    const combined: A2AEventLogEntry[] = [];
    const seen = new Set<string>();

    const append = (entries?: A2AEventLogEntry[]) => {
      if (!entries) {
        return;
      }
      for (const entry of entries) {
        if (!entry) {
          continue;
        }
        const key = `${entry.agentToolId ?? entry.agentKey ?? "unknown"}:${
          entry.timestamp ?? ""
        }:${entry.primaryTaskId ?? ""}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        combined.push(entry);
      }
    };

    append(persistedEventLog);
    append(streamA2AEventLog);

    combined.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    return combined.length > 0 ? combined : undefined;
  }, [persistedEventLog, streamA2AEventLog]);

  const value = useMemo(
    () => ({
      dataStream,
      setDataStream,
      mcpRegistry,
      a2aRegistry: resolvedA2ARegistry,
      a2aSessions: resolvedA2ASessions,
      a2aEventLog: resolvedA2AEventLog,
    }),
    [
      dataStream,
      mcpRegistry,
      resolvedA2ARegistry,
      resolvedA2ASessions,
      resolvedA2AEventLog,
    ]
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
