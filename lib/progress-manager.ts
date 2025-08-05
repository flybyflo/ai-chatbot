export interface ProgressUpdate {
  progress?: number;
  total?: number;
  description?: string;
  timestamp?: number;
}

export interface ToolProgressInfo {
  toolName: string;
  serverName: string;
  progressToken: string;
  updates: ProgressUpdate[];
  currentProgress?: ProgressUpdate;
}

type ProgressUpdateHandler = (toolProgressInfo: ToolProgressInfo) => void;

class ProgressManager {
  private progressUpdates: Map<string, ToolProgressInfo> = new Map();
  private updateHandlers: Set<ProgressUpdateHandler> = new Set();

  addUpdateHandler(handler: ProgressUpdateHandler) {
    this.updateHandlers.add(handler);
  }

  removeUpdateHandler(handler: ProgressUpdateHandler) {
    this.updateHandlers.delete(handler);
  }

  registerToolExecution(progressToken: string, toolName: string, serverName: string) {
    const toolProgressInfo: ToolProgressInfo = {
      toolName,
      serverName,
      progressToken,
      updates: [],
      currentProgress: undefined
    };
    
    this.progressUpdates.set(progressToken, toolProgressInfo);
  }

  updateProgress(progressToken: string, update: ProgressUpdate) {
    const toolProgressInfo = this.progressUpdates.get(progressToken);
    if (!toolProgressInfo) {
      return;
    }

    const timestampedUpdate = {
      ...update,
      timestamp: Date.now()
    };

    toolProgressInfo.updates.push(timestampedUpdate);
    toolProgressInfo.currentProgress = timestampedUpdate;

    // Notify all handlers
    this.updateHandlers.forEach(handler => {
      try {
        handler(toolProgressInfo);
      } catch (error) {
        console.error('Error in progress update handler:', error);
      }
    });
  }

  getProgressInfo(progressToken: string): ToolProgressInfo | undefined {
    return this.progressUpdates.get(progressToken);
  }

  getAllActiveProgress(): ToolProgressInfo[] {
    return Array.from(this.progressUpdates.values());
  }

  cleanupProgress(progressToken: string) {
    const toolProgressInfo = this.progressUpdates.get(progressToken);
    const deleted = this.progressUpdates.delete(progressToken);
    if (deleted && toolProgressInfo) {
      // Notify handlers about cleanup
      this.updateHandlers.forEach(handler => {
        try {
          handler({ ...toolProgressInfo, currentProgress: undefined, isCleanup: true } as any);
        } catch (error) {
          console.error('Error in cleanup handler:', error);
        }
      });
    }
  }

  // Legacy polling method - kept for compatibility but not used
  startPolling() {
    const pollInterval = setInterval(() => {
      // No-op - SSE handles all progress updates now
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }
}

// Ensure singleton across different API routes by using global
const globalForProgressManager = globalThis as unknown as {
  progressManager: ProgressManager | undefined;
};

if (!globalForProgressManager.progressManager) {
  globalForProgressManager.progressManager = new ProgressManager();
}

export const progressManager = globalForProgressManager.progressManager;