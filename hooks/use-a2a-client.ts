"use client";

import type { MessageSendParams } from "@a2a-js/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import type { A2AAgentConfig, A2AStreamEvent } from "@/lib/ai/a2a";
import { A2AManager } from "@/lib/ai/a2a";
import { generateUUID } from "@/lib/utils";

export type UseA2AClientOptions = {
  agents?: A2AAgentConfig[];
};

export function useA2AClient(options?: UseA2AClientOptions) {
  const [isReady, setIsReady] = useState(false);
  const [events, setEvents] = useState<A2AStreamEvent[]>([]);
  const managerRef = useRef<A2AManager | null>(null);

  useEffect(() => {
    const manager = new A2AManager();
    managerRef.current = manager;

    const configs =
      options?.agents ??
      A2AManager.parseAgentConfig(process.env.NEXT_PUBLIC_A2A_AGENTS);

    if (!configs || configs.length === 0) {
      setIsReady(false);
      return;
    }

    manager.initializeAgents(configs).then(() => {
      setIsReady(true);
    });

    return () => {
      manager.cleanup();
      managerRef.current = null;
    };
  }, [options?.agents]);

  const status = useMemo(() => managerRef.current?.getStatus() ?? {}, []);

  const sendStreamingMessage = async (
    agentName: string,
    params: Omit<MessageSendParams, "message"> & {
      text: string;
    }
  ) => {
    if (!managerRef.current) {
      throw new Error("A2A Manager not initialized");
    }
    const client = managerRef.current.getClient(agentName);
    if (!client) {
      throw new Error(`A2A agent not found: ${agentName}`);
    }

    const streamParams: MessageSendParams = {
      ...params,
      message: {
        messageId: generateUUID(),
        role: "user",
        parts: [{ kind: "text", text: params.text }],
        kind: "message",
      },
    };

    setEvents([]);
    for await (const event of client.sendMessageStream(streamParams)) {
      setEvents((prev) => [...prev, event]);
    }
  };

  return {
    isReady,
    status,
    events,
    sendStreamingMessage,
  } as const;
}
