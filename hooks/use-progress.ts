import { useState, useCallback } from 'react';
import type { ToolProgressInfo } from '@/lib/progress-manager';
import { useRealtime } from '@/hooks/use-realtime';
import type { OutboundMessage } from '@/lib/realtime/schema';

export function useProgress() {
  const [activeProgress, setActiveProgress] = useState<ToolProgressInfo[]>([]);

  const onRealtimeMessage = useCallback((data: OutboundMessage) => {
    if (data.type === 'progress') {
      setActiveProgress((current) => {
        const updated = [...current];
        const existingIndex = updated.findIndex(
          (p) => p.progressToken === data.progressToken,
        );
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            toolName: data.toolName,
            serverName: data.serverName,
            progressToken: data.progressToken,
            updates: updated[existingIndex].updates || [],
            currentProgress: data.currentProgress,
          };
        } else {
          updated.push({
            toolName: data.toolName,
            serverName: data.serverName,
            progressToken: data.progressToken,
            updates: [],
            currentProgress: data.currentProgress,
          });
        }
        return updated;
      });
    } else if (data.type === 'cleanup' && data.kind === 'progress') {
      setActiveProgress((current) =>
        current.filter((p) => p.progressToken !== data.token),
      );
    }
  }, []);

  useRealtime(onRealtimeMessage);

  const getProgressForTool = (toolName: string, serverName: string) => {
    const matches = activeProgress.filter(
      (p) => p.toolName === toolName && p.serverName === serverName,
    );
    if (matches.length === 0) return undefined;
    let best = matches[0];
    for (const m of matches) {
      const mt = m.currentProgress?.timestamp ?? 0;
      const bt = best.currentProgress?.timestamp ?? 0;
      if (mt > bt) best = m;
    }
    return best;
  };

  return {
    activeProgress,
    getProgressForTool,
  };
}
