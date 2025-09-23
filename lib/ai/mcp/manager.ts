import { MCPClientWrapper } from "./client";
import type {
  MCPServerConfig,
  MCPToolMetadata,
  MCPToolRegistry,
} from "./types";

export class MCPManager {
  private clients: Map<string, MCPClientWrapper> = new Map();
  private registry: MCPToolRegistry = {
    tools: {},
    metadata: {},
    serverStatus: {},
  };

  static parseServerConfig(configString: string): MCPServerConfig[] {
    if (!configString?.trim()) {
      console.log('⚠️ No MCP_SERVERS configured');
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
            const name = urlObj.hostname.replace(/\./g, "_") + "_" + urlObj.port;
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
      console.log('⚠️ No MCP servers to initialize');
      return;
    }

    // Initialize new clients
    const connectionPromises = configs.map(async (config) => {
      const client = new MCPClientWrapper(config);
      this.clients.set(config.name, client);

      const connected = await client.connect();
      this.registry.serverStatus[config.name] = client.getStatus();

      if (connected) {
        await this.loadToolsFromServer(config.name, client);
      } else {
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
      const config = client.getConfig();

      // Add tools with server namespace
      Object.entries(tools).forEach(([toolName, tool]) => {
        const namespacedName = `${serverName}_${toolName}`;
        this.registry.tools[namespacedName] = tool;
        this.registry.metadata[namespacedName] = {
          serverName,
          serverUrl: config.url,
          toolName,
          description: tool.description,
          isHealthy: client.isHealthy(),
        };
      });

      // Update server status with tool count
      if (this.registry.serverStatus[serverName]) {
        this.registry.serverStatus[serverName].toolCount =
          Object.keys(tools).length;
      }

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
    Object.keys(this.registry.tools).forEach((toolName) => {
      if (this.registry.metadata[toolName]?.serverName === serverName) {
        delete this.registry.tools[toolName];
        delete this.registry.metadata[toolName];
      }
    });

    // Reconnect and reload tools
    const connected = await client.connect();
    this.registry.serverStatus[serverName] = client.getStatus();

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
    this.registry = {
      tools: {},
      metadata: {},
      serverStatus: {},
    };
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
