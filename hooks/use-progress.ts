import { useEffect, useState } from 'react';
import type { ToolProgressInfo } from '@/lib/progress-manager';

export function useProgress() {
  const [activeProgress, setActiveProgress] = useState<ToolProgressInfo[]>([]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isComponentMounted = true;

    const connectToStream = () => {
      if (!isComponentMounted) return;
      
      eventSource = new EventSource('/api/progress/stream');
      
      eventSource.onmessage = (event) => {
        if (!isComponentMounted) return;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setActiveProgress(current => {
              const updated = [...current];
              const existingIndex = updated.findIndex(p => p.progressToken === data.progressToken);
              
              if (existingIndex >= 0) {
                // Update existing progress
                updated[existingIndex] = {
                  toolName: data.toolName,
                  serverName: data.serverName,
                  progressToken: data.progressToken,
                  updates: updated[existingIndex].updates || [],
                  currentProgress: data.currentProgress
                };
              } else {
                // Add new progress
                updated.push({
                  toolName: data.toolName,
                  serverName: data.serverName,
                  progressToken: data.progressToken,
                  updates: [],
                  currentProgress: data.currentProgress
                });
              }
              
              return updated;
            });
          } else if (data.type === 'cleanup') {
            setActiveProgress(current => 
              current.filter(p => p.progressToken !== data.progressToken)
            );
          }
        } catch (error) {
          console.error('Error parsing progress data:', error);
        }
      };
      
      eventSource.onerror = () => {
        eventSource?.close();
        
        // Attempt to reconnect after a delay if component is still mounted
        if (isComponentMounted) {
          reconnectTimeout = setTimeout(connectToStream, 2000);
        }
      };
    };

    // Initial connection
    connectToStream();

    return () => {
      isComponentMounted = false;
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const getProgressForTool = (toolName: string, serverName: string) => {
    return activeProgress.find(p => p.toolName === toolName && p.serverName === serverName);
  };

  return {
    activeProgress,
    getProgressForTool,
  };
}