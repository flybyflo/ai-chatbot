export interface ElicitationInfo {
  elicitationToken: string;
  serverName: string;
  message: string;
  responseType: any;
  timestamp: number;
}

export interface ElicitationResponse {
  elicitationToken: string;
  action: 'accept' | 'decline' | 'cancel';
  data?: any;
}

class ElicitationManager {
  private updateHandlers: Set<(info: any) => void> = new Set();
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: ElicitationResponse) => void;
      reject: (error: any) => void;
      info: ElicitationInfo;
    }
  >();

  // Register update handler for SSE
  addUpdateHandler(handler: (info: any) => void) {
    this.updateHandlers.add(handler);
  }

  // Remove update handler
  removeUpdateHandler(handler: (info: any) => void) {
    this.updateHandlers.delete(handler);
  }

  // Create elicitation request and broadcast to SSE clients
  async requestUserInput(
    serverName: string,
    message: string,
    responseType: any,
  ): Promise<ElicitationResponse> {
    const elicitationToken = this.generateRequestId();

    const elicitationInfo: ElicitationInfo = {
      elicitationToken,
      serverName,
      message,
      responseType,
      timestamp: Date.now(),
    };

    console.log(
      `🎯 Creating elicitation request ${elicitationToken}:`,
      elicitationInfo,
    );

    // Create promise to wait for user response
    const responsePromise = new Promise<ElicitationResponse>(
      (resolve, reject) => {
        this.pendingRequests.set(elicitationToken, {
          resolve,
          reject,
          info: elicitationInfo,
        });

        // Set timeout (30 seconds)
        setTimeout(() => {
          if (this.pendingRequests.has(elicitationToken)) {
            this.pendingRequests.delete(elicitationToken);
            reject(new Error('Elicitation request timed out'));
          }
        }, 30000);
      },
    );

    // Broadcast to SSE clients
    this.broadcastUpdate({
      type: 'elicitation_request',
      ...elicitationInfo,
    });

    return responsePromise;
  }

  // Handle response from client
  handleResponse(response: ElicitationResponse) {
    console.log(
      `✅ Received elicitation response for ${response.elicitationToken}:`,
      response,
    );

    const pending = this.pendingRequests.get(response.elicitationToken);
    if (pending) {
      this.pendingRequests.delete(response.elicitationToken);
      pending.resolve(response);
    }

    // Broadcast cleanup to SSE clients
    this.broadcastUpdate({
      type: 'elicitation_cleanup',
      elicitationToken: response.elicitationToken,
    });
  }

  // Cancel elicitation request
  cancelRequest(elicitationToken: string) {
    const pending = this.pendingRequests.get(elicitationToken);
    if (pending) {
      this.pendingRequests.delete(elicitationToken);
      pending.resolve({
        elicitationToken,
        action: 'cancel',
      });
    }

    this.broadcastUpdate({
      type: 'elicitation_cleanup',
      elicitationToken,
    });
  }

  private broadcastUpdate(info: any) {
    console.log(`📡 Broadcasting elicitation update:`, info);
    for (const handler of this.updateHandlers) {
      try {
        handler(info);
      } catch (error) {
        console.error('Error in elicitation update handler:', error);
        this.updateHandlers.delete(handler);
      }
    }

    // Publish to Redis for external realtime gateway
    void (async () => {
      try {
        const { getRedisPub } = await import('@/lib/realtime/redis');
        const pub = await getRedisPub();
        const payload =
          info.type === 'elicitation_cleanup'
            ? {
                type: 'cleanup',
                kind: 'elicitation',
                token: info.elicitationToken,
              }
            : {
                type: 'elicitation',
                elicitationToken: info.elicitationToken,
                serverName: info.serverName,
                message: info.message,
                responseType: info.responseType,
                timestamp: info.timestamp,
              };
        await pub.publish('rt:events', JSON.stringify(payload));
      } catch {}
    })();
  }

  generateRequestId(): string {
    return `elicitation-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // Get pending requests (for debugging)
  getPendingRequests() {
    return Array.from(this.pendingRequests.entries()).map(([token, data]) => ({
      token,
      info: data.info,
    }));
  }
}

// Ensure singleton across different API routes by using global
const globalForElicitationManager = globalThis as unknown as {
  elicitationManager: ElicitationManager | undefined;
};

if (!globalForElicitationManager.elicitationManager) {
  globalForElicitationManager.elicitationManager = new ElicitationManager();
}

export const elicitationManager =
  globalForElicitationManager.elicitationManager;

// Subscribe for elicitation responses from external realtime gateway
(async () => {
  try {
    const { getRedisSub } = await import('@/lib/realtime/redis');
    const sub = await getRedisSub();
    await sub.subscribe('rt:elicitation:response', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg?.type === 'elicitation_response') {
          elicitationManager.handleResponse({
            elicitationToken: msg.elicitationToken,
            action: msg.action,
            data: msg.data,
          });
        }
      } catch {}
    });
  } catch {}
})();
