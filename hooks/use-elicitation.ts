import { useState, useCallback } from 'react';
import type { ElicitationInfo } from '@/lib/elicitation-manager';
import { useRealtime } from '@/hooks/use-realtime';
import type { OutboundMessage } from '@/lib/realtime/schema';

export function useElicitation() {
  const [activeElicitations, setActiveElicitations] = useState<
    ElicitationInfo[]
  >([]);

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
      setActiveElicitations((current) => {
        const updated = [...current];
        const existingIndex = updated.findIndex(
          (e) => e.elicitationToken === data.elicitationToken,
        );
        const entry = {
          elicitationToken: data.elicitationToken,
          serverName: data.serverName,
          message: data.message,
          responseType: data.responseType as any,
          timestamp: data.timestamp,
        } satisfies ElicitationInfo;
        if (existingIndex >= 0) {
          updated[existingIndex] = entry;
        } else {
          updated.push(entry);
        }
        return updated;
      });
    } else if (data.type === 'cleanup' && data.kind === 'elicitation') {
      setActiveElicitations((current) =>
        current.filter((e) => e.elicitationToken !== data.token),
      );
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
