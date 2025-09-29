import { A2AClientWrapper } from "./client";
import type {
  A2AAgentConfig,
  A2AAgentStatus,
  A2ASessionState,
  AgentCard,
} from "./types";

type AgentKey = string;

type AgentRecord = {
  key: AgentKey;
  config: A2AAgentConfig;
  status: A2AAgentStatus;
  card?: AgentCard;
  session?: A2ASessionState;
};

export class A2AManager {
  private readonly clients: Map<AgentKey, A2AClientWrapper> = new Map();
  private registry: Record<AgentKey, AgentRecord> = {};

  private static getKey(config: A2AAgentConfig): AgentKey {
    return config.id ?? config.name;
  }

  static parseAgentConfig(envString: string | undefined): A2AAgentConfig[] {
    if (!envString?.trim()) {
      return [];
    }
    return envString
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const colon = entry.indexOf(":");
        if (colon === -1 || entry.startsWith("http")) {
          try {
            const urlObj = new URL(entry);
            const name = urlObj.hostname.replace(/\./g, "_");
            return { name, cardUrl: entry };
          } catch {
            return { name: entry, cardUrl: entry };
          }
        }
        const name = entry.slice(0, colon);
        const cardUrl = entry.slice(colon + 1);
        return { name, cardUrl };
      });
  }

  async initializeAgents(configs: A2AAgentConfig[]): Promise<void> {
    this.cleanup();
    const tasks = configs.map(async (config) => {
      const key = A2AManager.getKey(config);
      const client = new A2AClientWrapper(config);
      this.clients.set(key, client);
      const ok = await client.init();
      let card: AgentCard | undefined;
      if (ok) {
        try {
          card = await client.getAgentCard();
        } catch (error) {
          console.warn(
            `Failed to fetch agent card for A2A agent ${config.name}:`,
            error
          );
        }
      }
      this.registry[key] = {
        key,
        config,
        status: client.getStatus(),
        card,
        session: this.registry[key]?.session,
      };
    });
    await Promise.allSettled(tasks);
  }

  getStatus(): Record<AgentKey, A2AAgentStatus> {
    return Object.fromEntries(
      Object.entries(this.registry).map(([key, record]) => [key, record.status])
    );
  }

  getRegistry(): Record<AgentKey, AgentRecord> {
    return { ...this.registry };
  }

  getClient(key: AgentKey): A2AClientWrapper | undefined {
    return this.clients.get(key);
  }

  getSession(key: AgentKey): A2ASessionState | undefined {
    return this.registry[key]?.session;
  }

  updateSession(key: AgentKey, sessionUpdate: Partial<A2ASessionState>): void {
    const record = this.registry[key];
    if (!record) {
      return;
    }
    const previousMessages = record.session?.messages ?? [];
    const newMessages = sessionUpdate.messages ?? [];
    const mergedMessagesUnfiltered = [...previousMessages, ...newMessages];
    const seenMessageKeys = new Set<string>();
    const mergedMessages = mergedMessagesUnfiltered.filter((message, index) => {
      const key =
        message.messageId ||
        `${message.taskId ?? ""}:${message.role ?? ""}:$${message.text ?? ""}:${index}`;
      if (seenMessageKeys.has(key)) {
        return false;
      }
      seenMessageKeys.add(key);
      return true;
    });
    const next: A2ASessionState = {
      contextId: sessionUpdate.contextId ?? record.session?.contextId,
      primaryTaskId:
        sessionUpdate.primaryTaskId ?? record.session?.primaryTaskId,
      tasks: {
        ...record.session?.tasks,
        ...sessionUpdate.tasks,
      },
      lastUpdated: sessionUpdate.lastUpdated ?? record.session?.lastUpdated,
      messages: mergedMessages,
      lastResponseText:
        sessionUpdate.lastResponseText ?? record.session?.lastResponseText,
    };
    record.session = next;
    this.registry[key] = { ...record };
  }

  cleanup(): void {
    this.clients.clear();
    this.registry = {};
  }
}
