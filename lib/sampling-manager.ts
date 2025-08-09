export interface SamplingRequestInfo {
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

export interface SamplingApprovalResult {
  approved: boolean;
  modifiedSystemPrompt?: string;
}

class SamplingManager {
  private pending = new Map<
    string,
    {
      resolve: (value: SamplingApprovalResult) => void;
      reject: (error: unknown) => void;
    }
  >();

  async requestApproval(
    info: Omit<SamplingRequestInfo, 'requestId'>,
  ): Promise<SamplingApprovalResult> {
    const requestId = this.generateRequestId();

    const payload: SamplingRequestInfo = {
      requestId,
      serverName: info.serverName,
      messages: info.messages,
      systemPrompt: info.systemPrompt,
      maxTokens: info.maxTokens,
      temperature: info.temperature,
      modelPreferences: info.modelPreferences,
    };

    const resultPromise = new Promise<SamplingApprovalResult>(
      (resolve, reject) => {
        this.pending.set(requestId, { resolve, reject });
        // Timeout after 60s
        setTimeout(() => {
          if (this.pending.has(requestId)) {
            this.pending.delete(requestId);
            reject(new Error('Sampling request timed out'));
          }
        }, 60_000);
      },
    );

    // Publish to Redis for the realtime gateway to broadcast
    void (async () => {
      try {
        const { getRedisPub } = await import('@/lib/realtime/redis');
        const pub = await getRedisPub();
        await pub.publish(
          'rt:events',
          JSON.stringify({
            type: 'sampling_request',
            requestId: payload.requestId,
            serverName: payload.serverName,
            messages: payload.messages,
            systemPrompt: payload.systemPrompt,
            maxTokens: payload.maxTokens,
            temperature: payload.temperature,
            modelPreferences: payload.modelPreferences,
          }),
        );
      } catch {
        // ignore pub errors
      }
    })();

    return resultPromise;
  }

  handleResponse(
    requestId: string,
    approved: boolean,
    modifiedSystemPrompt?: string,
  ) {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    pending.resolve({ approved, modifiedSystemPrompt });

    // Emit cleanup so clients remove the UI
    void (async () => {
      try {
        const { getRedisPub } = await import('@/lib/realtime/redis');
        const pub = await getRedisPub();
        await pub.publish(
          'rt:events',
          JSON.stringify({
            type: 'cleanup',
            kind: 'sampling',
            token: requestId,
          }),
        );
      } catch {
        // ignore
      }
    })();
  }

  generateRequestId(): string {
    return `sampling-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const samplingManager = new SamplingManager();

// Subscribe for sampling responses from realtime gateway
(async () => {
  try {
    const { getRedisSub } = await import('@/lib/realtime/redis');
    const sub = await getRedisSub();
    await sub.subscribe('rt:sampling:response', (raw) => {
      try {
        const msg = JSON.parse(raw) as {
          type: 'sampling_response';
          requestId: string;
          approved: boolean;
          modifiedSystemPrompt?: string;
        };
        if (msg?.type === 'sampling_response' && msg.requestId) {
          samplingManager.handleResponse(
            msg.requestId,
            msg.approved,
            msg.modifiedSystemPrompt,
          );
        }
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
})();
