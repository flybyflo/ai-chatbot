'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { InboundMessage, OutboundMessage } from '@/lib/realtime/schema';

let socket: Socket | null = null;
const listeners = new Set<(msg: OutboundMessage) => void>();

function ensureSocket() {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3030', {
    transports: ['websocket'],
  });
  socket.on('connect', () => console.log('[SIO] connected', socket?.id));
  socket.on('event', (data) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SIO] event', (data as any)?.type);
    }
    for (const l of listeners) l(data as OutboundMessage);
  });
  socket.on('disconnect', (r) => console.log('[SIO] disconnect', r));
  socket.on('connect_error', (e) => console.log('[SIO] error', e.message));
  return socket;
}

export function useRealtime(onMessage: (msg: OutboundMessage) => void) {
  useEffect(() => {
    ensureSocket();
    listeners.add(onMessage);
    return () => {
      listeners.delete(onMessage);
    };
  }, [onMessage]);

  const send = (msg: InboundMessage) => {
    const s = ensureSocket();
    if (msg.type === 'elicitation_response') {
      s.emit('elicitation_response', msg);
    } else if (msg.type === 'sampling_response') {
      s.emit('sampling_response', msg);
    }
  };

  return { send };
}
