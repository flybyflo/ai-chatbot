import { EventEmitter } from "node:events";
import { MCPClientWrapper } from "./client";
import type { MCPServerConfig, MCPToolRegistry } from "./types";

export class MCPManager extends EventEmitter {
  private readonly clients: Map<string, MCPClientWrapper> = new Map();
  private registry: MCPToolRegistry = {
    tools: {},
    metadata: {},
    serverStatus: {},
  };
  private serializedRegistry: MCPToolRegistry = {
    tools: {},
    metadata: {},
    serverStatus: {},
  };

  private resetRegistry() {
    this.registry = {
      tools: {},
      metadata: {},
      serverStatus: {},
    };
    this.serializedRegistry = {
      tools: {},
      metadata: {},
      serverStatus: {},
    };
  }

  private sanitizeForJson(value: any): any {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeForJson(item))
        .filter((item) => item !== undefined);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value && typeof value === "object") {
      const result: Record<string, any> = {};
      for (const [key, nested] of Object.entries(value)) {
        const sanitized = this.sanitizeForJson(nested);
        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      }
      return result;
    }

    return;
  }

  private serializeTools(tools: Record<string, any>) {
    const serialized: Record<string, any> = {};
    for (const [toolName, tool] of Object.entries(tools)) {
      const sanitized = this.sanitizeForJson(tool);
      if (sanitized !== undefined) {
        serialized[toolName] = sanitized;
      }
    }
    return serialized;
  }

  private buildRegistryByServer(source: MCPToolRegistry) {
    const byServer: Record<string, MCPToolRegistry> = {};

    for (const [toolId, metadata] of Object.entries(source.metadata)) {
      const { serverName } = metadata;
      if (!byServer[serverName]) {
        byServer[serverName] = {
          tools: {},
          metadata: {},
          serverStatus: {},
        };
      }
      byServer[serverName].metadata[toolId] = metadata;
      if (source.tools[toolId]) {
        byServer[serverName].tools[toolId] = source.tools[toolId];
      }
    }

    for (const [serverName, status] of Object.entries(source.serverStatus)) {
      if (!byServer[serverName]) {
        byServer[serverName] = {
          tools: {},
          metadata: {},
          serverStatus: {},
        };
      }
      byServer[serverName].serverStatus[serverName] = status;
    }

    return byServer;
  }

  static parseServerConfig(configString: string): MCPServerConfig[] {
    if (!configString?.trim()) {
      return [];
    }

    const configs = configString
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        // Handle name:url format or just url
        const colonIndex = entry.indexOf(":");
        if (colonIndex === -1 || entry.startsWith("http")) {
          // Just a URL, generate a name
          const url = entry;
          try {
            const urlObj = new URL(url);
            const name = `${urlObj.hostname.replace(/\./g, "_")}_${urlObj.port}`;
            return { name, url };
          } catch (error) {
            console.error(`❌ Invalid URL: ${url}`, error);
            return null;
          }
        } else {
          // name:url format
          const name = entry.substring(0, colonIndex);
          const url = entry.substring(colonIndex + 1);
          return { name, url };
        }
      })
      .filter((config): config is MCPServerConfig => config !== null);

    return configs;
  }

  async initializeServers(configs: MCPServerConfig[]): Promise<void> {
    // Close any existing clients
    await this.cleanup();

    if (configs.length === 0) {
      return;
    }

    // Initialize new clients
    const connectionPromises = configs.map(async (config) => {
      const client = new MCPClientWrapper(config);
      this.clients.set(config.name, client);

      const connected = await client.connect();
      const status = client.getStatus();
      this.registry.serverStatus[config.name] = { ...status };
      this.serializedRegistry.serverStatus[config.name] = { ...status };

      if (connected) {
        await this.loadToolsFromServer(config.name, client);
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  private async loadToolsFromServer(
    serverName: string,
    client: MCPClientWrapper
  ): Promise<void> {
    try {
      const tools = await client.getTools();
      const serializedTools = this.serializeTools(tools);
      const config = client.getConfig();

      // Add tools with server namespace
      for (const [toolName, tool] of Object.entries(tools)) {
        const namespacedName = `${serverName}_${toolName}`;
        this.registry.tools[namespacedName] = tool;
        this.serializedRegistry.tools[namespacedName] =
          serializedTools[toolName] ?? {};
        this.registry.metadata[namespacedName] = {
          serverName,
          serverUrl: config.url,
          toolName,
          description: tool.description,
          isHealthy: client.isHealthy(),
        };
        this.serializedRegistry.metadata[namespacedName] = {
          serverName,
          serverUrl: config.url,
          toolName,
          description: tool.description,
          isHealthy: client.isHealthy(),
        };
      }

      // Update server status with tool count
      const status = client.getStatus();
      const toolCount = Object.keys(tools).length;
      this.registry.serverStatus[serverName] = {
        ...status,
        toolCount,
      };
      this.serializedRegistry.serverStatus[serverName] = {
        ...status,
        toolCount,
      };
    } catch (error) {
      console.warn(`Failed to load tools from server ${serverName}:`, error);
    }
  }

  getRegistry(): MCPToolRegistry {
    return {
      tools: { ...this.registry.tools },
      metadata: { ...this.registry.metadata },
      serverStatus: { ...this.registry.serverStatus },
    };
  }

  getSerializableRegistry(): MCPToolRegistry {
    return {
      tools: { ...this.serializedRegistry.tools },
      metadata: { ...this.serializedRegistry.metadata },
      serverStatus: { ...this.serializedRegistry.serverStatus },
    };
  }

  getRegistryByServer(): Record<string, MCPToolRegistry> {
    return this.buildRegistryByServer(this.registry);
  }

  getSerializableRegistryByServer(): Record<string, MCPToolRegistry> {
    return this.buildRegistryByServer(this.serializedRegistry);
  }

  getTools(): Record<string, any> {
    return { ...this.registry.tools };
  }

  getServerStatus(): Record<string, any> {
    return { ...this.registry.serverStatus };
  }

  async refreshServer(serverName: string): Promise<boolean> {
    const client = this.clients.get(serverName);
    if (!client) {
      return false;
    }

    // Remove existing tools from this server
    for (const toolName of Object.keys(this.registry.tools)) {
      if (this.registry.metadata[toolName]?.serverName === serverName) {
        delete this.registry.tools[toolName];
        delete this.registry.metadata[toolName];
        delete this.serializedRegistry.tools[toolName];
        delete this.serializedRegistry.metadata[toolName];
      }
    }

    // Reconnect and reload tools
    const connected = await client.connect();
    const status = client.getStatus();
    this.registry.serverStatus[serverName] = { ...status };
    this.serializedRegistry.serverStatus[serverName] = { ...status };

    if (connected) {
      await this.loadToolsFromServer(serverName, client);
      return true;
    }

    return false;
  }

  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.clients.values()).map((client) =>
      client.close()
    );

    await Promise.allSettled(closePromises);

    this.clients.clear();
    this.resetRegistry();
  }

  isServerHealthy(serverName: string): boolean {
    const status = this.registry.serverStatus[serverName];
    return status?.isConnected && !status.lastError;
  }

  getHealthyServers(): string[] {
    return Object.keys(this.registry.serverStatus).filter((serverName) =>
      this.isServerHealthy(serverName)
    );
  }
}
