"use client";

import type { DataUIPart } from "ai";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
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
  setChatId: (chatId: string | undefined) => void;
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
  const [chatId, setChatId] = useState<string | undefined>(undefined);

  // Auto-detect if we're in a chat route to avoid loading global events
  const params = useParams();
  const paramsChatId = params?.id as string | undefined;

  // Use explicit chatId if set, otherwise fall back to params
  const effectiveChatId = chatId ?? paramsChatId;

  console.log("[A2A-PROVIDER] Context detected:", {
    chatId: effectiveChatId || "none (global context)",
    explicitChatId: chatId,
    paramsChatId,
    timestamp: new Date().toISOString(),
  });

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
    const events = dataStream.filter((part) => {
      const type = part.type as string;
      return type === "data-a2aEvents" || type === "data-a2a-events";
    });

    if (events.length > 0) {
      console.group("[A2A-PROVIDER] Stream A2A Events Extracted");
      console.log("Chat ID:", effectiveChatId || "global");
      console.log("Events count:", events.length);
      console.log("Events:", events.map((e) => ({
        agentToolId: (e.data as any)?.agentToolId,
        contextId: (e.data as any)?.contextId,
        primaryTaskId: (e.data as any)?.primaryTaskId,
        timestamp: (e.data as any)?.timestamp,
      })));
      console.groupEnd();
    }

    return events;
  }, [dataStream, effectiveChatId]);

  const streamA2ASessions = useMemo(() => {
    const sessions: Record<string, A2ASessionSnapshot> = {};

    if (streamA2AEvents.length > 0) {
      console.group("[A2A-PROVIDER] Building Stream Sessions");
      console.log("Chat ID:", effectiveChatId || "global");
      console.log("Processing events:", streamA2AEvents.length);
    }

    for (const part of streamA2AEvents) {
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

    if (streamA2AEvents.length > 0) {
      console.log("Total sessions created:", Object.keys(sessions).length);
      console.groupEnd();
    }

    return sessions;
  }, [streamA2AEvents, effectiveChatId]);

  const streamA2AEventLog = useMemo(() => {
    const entries: A2AEventLogEntry[] = [];
    for (const part of streamA2AEvents) {
      const payload = part.data as A2AToolEventPayload | undefined;
      if (!payload) {
        continue;
      }
      entries.push(payload);
    }
    const sorted = entries.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    if (sorted.length > 0) {
      console.log("[A2A-PROVIDER] Stream Event Log:", {
        chatId: effectiveChatId || "global",
        count: sorted.length,
        entries: sorted.map((e) => ({
          agentToolId: e.agentToolId,
          timestamp: e.timestamp,
          primaryTaskId: e.primaryTaskId,
        })),
      });
    }

    return sorted;
  }, [streamA2AEvents, effectiveChatId]);

  // Load A2A data with chat-specific filtering
  // When chatId is present, only load events for that specific chat
  // When no chatId (e.g., settings page), load global A2A data
  const persistedA2A = useQuery(
    api.queries.getA2AData,
    effectiveChatId ? { chatId: effectiveChatId } : {}
  );

  if (persistedA2A) {
    console.group(
      `[A2A-PROVIDER] Persisted A2A Data Loaded (${effectiveChatId ? `Chat: ${effectiveChatId}` : "Global Context"})`
    );
    console.log("Has registry:", !!persistedA2A.registry);
    console.log("Sessions count:", persistedA2A.sessions?.length ?? 0);
    console.log("Events count:", persistedA2A.events?.length ?? 0);
    console.groupEnd();
  }

  // Use persisted data (now filtered by chatId in the query)
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
    console.group("[A2A-PROVIDER] Resolving Event Log");
    console.log("Chat ID:", effectiveChatId || "global");
    console.log("Persisted events:", persistedEventLog?.length ?? 0);
    console.log("Stream events:", streamA2AEventLog?.length ?? 0);

    const combined: A2AEventLogEntry[] = [];
    const seenSource = new Set<string>();

    const append = (entries?: A2AEventLogEntry[], source?: string) => {
      if (!entries) {
        return;
      }
      let addedCount = 0;
      for (const entry of entries) {
        if (!entry) {
          continue;
        }
        const sourceKey = `${entry.agentToolId ?? entry.agentKey ?? "unknown"}:${
          entry.timestamp ?? ""
        }:${entry.primaryTaskId ?? ""}`;
        if (seenSource.has(sourceKey)) {
          console.log(`[A2A-PROVIDER] Skipping duplicate from ${source}:`, {
            sourceKey,
            agentToolId: entry.agentToolId,
            timestamp: entry.timestamp,
          });
          continue;
        }
        seenSource.add(sourceKey);
        combined.push(entry);
        addedCount++;
      }
      if (addedCount > 0) {
        console.log(`[A2A-PROVIDER] Added ${addedCount} events from ${source}`);
      }
    };

    append(persistedEventLog, "persisted");
    append(streamA2AEventLog, "stream");

    combined.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    console.log("Combined before final dedup:", combined.length);

    if (combined.length === 0) {
      console.log("No events to resolve");
      console.groupEnd();
      return;
    }

    const deduped: A2AEventLogEntry[] = [];
    const seenUnique = new Set<string>();

    for (const entry of combined) {
      const lastMessage = entry.messages?.at(-1);
      const uniqueKey = [
        entry.agentToolId ?? entry.agentKey ?? "unknown",
        entry.primaryTaskId ?? "",
        entry.contextId ?? "",
        lastMessage?.messageId ?? "",
        entry.responseText?.trim() ?? "",
      ]
        .join(":")
        .toLowerCase();

      if (seenUnique.has(uniqueKey)) {
        console.log("[A2A-PROVIDER] Final dedup removed:", {
          uniqueKey: uniqueKey.substring(0, 100),
          agentToolId: entry.agentToolId,
        });
        continue;
      }

      seenUnique.add(uniqueKey);
      deduped.push(entry);
    }

    console.log("Final event log count:", deduped.length);
    console.log("Final events:", deduped.map((e) => ({
      agentToolId: e.agentToolId,
      timestamp: e.timestamp,
      primaryTaskId: e.primaryTaskId,
      contextId: e.contextId,
    })));
    console.groupEnd();

    return deduped.length > 0 ? deduped : undefined;
  }, [persistedEventLog, streamA2AEventLog, effectiveChatId]);

  const value = useMemo(
    () => ({
      dataStream,
      setDataStream,
      setChatId,
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
