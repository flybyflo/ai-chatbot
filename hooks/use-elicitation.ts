import { useState, useCallback, useEffect } from 'react';
import type { ElicitationInfo } from '@/lib/elicitation-manager';
import { useRealtime } from '@/hooks/use-realtime';
import type { OutboundMessage } from '@/lib/realtime/schema';
import {
  addOrUpdateElicitation,
  removeElicitation,
  subscribeElicitations,
} from '@/lib/elicitation-store';

export function useElicitation() {
  const [activeElicitations, setActiveElicitations] = useState<
    ElicitationInfo[]
  >([]);

  // Keep state in sync with a small module-level store, so late mounts don't miss events
  useEffect(() => {
    return subscribeElicitations(setActiveElicitations);
  }, []);

  const onRealtimeMessage = useCallback((data: OutboundMessage) => {
    if (process.env.NODE_ENV !== 'production') {
      // Debug inbound WS messages
      if (data.type === 'elicitation') {
        console.log('[WS][client] elicitation', data);
      } else if (data.type === 'cleanup' && data.kind === 'elicitation') {
        console.log('[WS][client] elicitation cleanup', data.token);
      }
    }
    if (data.type === 'elicitation') {
      addOrUpdateElicitation({
        elicitationToken: data.elicitationToken,
        serverName: data.serverName,
        message: data.message,
        responseType: data.responseType as any,
        timestamp: data.timestamp,
      });
    } else if (data.type === 'cleanup' && data.kind === 'elicitation') {
      removeElicitation(data.token);
    }
  }, []);

  const { send } = useRealtime(onRealtimeMessage);

  const respondToElicitation = (
    elicitationToken: string,
    action: 'accept' | 'decline' | 'cancel',
    data?: any,
  ) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[WS][client] send elicitation_response', {
        elicitationToken,
        action,
        data,
      });
    }
    send({ type: 'elicitation_response', elicitationToken, action, data });
  };

  return {
    activeElicitations,
    respondToElicitation,
  };
}
