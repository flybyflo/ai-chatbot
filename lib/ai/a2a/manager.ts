import { A2AClientWrapper } from "./client";
import type { A2AAgentConfig, A2AAgentStatus } from "./types";

export class A2AManager {
  private readonly clients: Map<string, A2AClientWrapper> = new Map();
  private registry: Record<string, A2AAgentStatus> = {};

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
      const client = new A2AClientWrapper(config);
      this.clients.set(config.name, client);
      const ok = await client.init();
      this.registry[config.name] = client.getStatus();
      if (ok) {
        // agent ready
      }
    });
    await Promise.allSettled(tasks);
  }

  getStatus(): Record<string, A2AAgentStatus> {
    return { ...this.registry };
  }

  getClient(name: string): A2AClientWrapper | undefined {
    return this.clients.get(name);
  }

  cleanup(): void {
    this.clients.clear();
    this.registry = {};
  }
}
