import type { MessageSendParams } from "@a2a-js/sdk";
import { A2AClient } from "@a2a-js/sdk/client";
import type {
  A2AAgentConfig,
  A2AAgentStatus,
  A2AStreamEvent,
  AgentCard,
} from "./types";

export class A2AClientWrapper {
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private client: A2AClient | null = null;
  private readonly config: A2AAgentConfig;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private isReady = false;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private lastError: string | undefined;

  constructor(config: A2AAgentConfig) {
    this.config = config;
  }

  private resolveAgentCardUrl(inputUrl: string): string {
    try {
      const url = new URL(inputUrl);
      const path = url.pathname;
      const isAlreadyCard =
        path.endsWith("/.well-known/agent-card.json") ||
        path.endsWith("agent-card.json");
      if (isAlreadyCard) {
        return url.toString();
      }
      // Ensure trailing slash
      if (!url.pathname.endsWith("/")) {
        url.pathname = `${url.pathname}/`;
      }
      url.pathname = `${url.pathname}.well-known/agent-card.json`;
      return url.toString();
    } catch (_e) {
      // Fall back to the provided string
      return inputUrl;
    }
  }

  async init(): Promise<boolean> {
    try {
      const resolvedCardUrl = this.resolveAgentCardUrl(this.config.cardUrl);
      this.client = await A2AClient.fromCardUrl(resolvedCardUrl);
      this.isReady = true;
      this.lastError = undefined;
      return true;
    } catch (error) {
      this.isReady = false;
      this.lastError = error instanceof Error ? error.message : "Unknown error";
      return false;
    }
  }

  getStatus(): A2AAgentStatus {
    return {
      id: this.config.id,
      name: this.config.name,
      cardUrl: this.config.cardUrl,
      isReady: this.isReady,
      lastError: this.lastError,
    };
  }

  getConfig(): A2AAgentConfig {
    return { ...this.config };
  }

  async *sendMessageStream(params: MessageSendParams) {
    if (!this.client) {
      throw new Error("A2A client not initialized");
    }

    console.log("🌐 A2A stream initiated", {
      agent: this.config.name,
      cardUrl: this.config.cardUrl,
      messageId: (params.message as any)?.messageId,
      hasContextId: !!(params.message as any)?.contextId,
    });

    let eventCount = 0;
    try {
      for await (const event of this.client.sendMessageStream(params)) {
        eventCount++;
        yield event as A2AStreamEvent;
      }
      console.log("🏁 A2A stream completed", {
        agent: this.config.name,
        eventsReceived: eventCount,
      });
    } catch (error) {
      console.error("💥 A2A stream error", {
        agent: this.config.name,
        eventsReceived: eventCount,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getAgentCard(): Promise<AgentCard | undefined> {
    if (!this.client) {
      return;
    }
    return await this.client.getAgentCard();
  }
}
