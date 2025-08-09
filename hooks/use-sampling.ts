'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/use-realtime';
import type { OutboundMessage, InboundMessage } from '@/lib/realtime/schema';

export interface ActiveSamplingRequest {
  requestId: string;
  serverName: string;
  messages?: Array<{
    role: string;
    content: { type: string; text: string };
  }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  modelPreferences?: {
    speedPriority?: number;
    intelligencePriority?: number;
    costPriority?: number;
  };
}

// Module-level shared store to avoid missing events when components mount later
type SamplingState = ActiveSamplingRequest[];
const samplingListeners = new Set<(state: SamplingState) => void>();
const samplingState: SamplingState = [];

function notifySampling(): void {
  const snapshot = samplingState.slice();
  for (const l of samplingListeners) l(snapshot);
}

function addOrUpdateSampling(entry: ActiveSamplingRequest): void {
  const idx = samplingState.findIndex((e) => e.requestId === entry.requestId);
  if (idx >= 0) samplingState[idx] = entry;
  else samplingState.push(entry);
  notifySampling();
}

function removeSampling(requestId: string): void {
  const idx = samplingState.findIndex((e) => e.requestId === requestId);
  if (idx >= 0) {
    samplingState.splice(idx, 1);
    notifySampling();
  }
}

function subscribeSampling(
  listener: (state: SamplingState) => void,
): () => void {
  samplingListeners.add(listener);
  // Immediately provide a snapshot
  listener(samplingState.slice());
  return () => samplingListeners.delete(listener);
}

export function useSampling() {
  const [activeSampling, setActiveSampling] =
    useState<ActiveSamplingRequest[]>(samplingState);

  const onRealtimeMessage = useCallback((data: OutboundMessage) => {
    if (data.type === 'sampling_request') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WS][client] sampling_request', data.requestId);
      }
      addOrUpdateSampling({
        requestId: data.requestId,
        serverName: data.serverName,
        messages: data.messages,
        systemPrompt: data.systemPrompt,
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        modelPreferences: data.modelPreferences,
      });
    } else if (data.type === 'cleanup' && data.kind === 'sampling') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WS][client] sampling cleanup', data.token);
      }
      removeSampling(data.token);
    }
  }, []);

  const { send } = useRealtime(onRealtimeMessage);

  // Keep local state in sync with the shared store (proper effect with cleanup)
  useEffect(() => {
    const unsubscribe = subscribeSampling(setActiveSampling);
    return () => unsubscribe();
  }, []);

  const respondToSampling = (
    requestId: string,
    approved: boolean,
    modifiedSystemPrompt?: string,
  ) => {
    const msg: InboundMessage = {
      type: 'sampling_response',
      requestId,
      approved,
      modifiedSystemPrompt,
    };
    if (process.env.NODE_ENV !== 'production') {
      console.log('[WS][client] send sampling_response', msg);
    }
    send(msg);
  };

  return { activeSampling, respondToSampling };
}
