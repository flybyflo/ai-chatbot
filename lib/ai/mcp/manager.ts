import { EventEmitter } from "node:events";
import { MCPClientWrapper } from "./client";
import type {
  MCPProgressCallback,
  MCPProgressNotification,
  MCPProgressState,
  MCPProgressToken,
  MCPToolCallOptions,
} from "./progress-types";
import type { MCPServerConfig, MCPToolRegistry } from "./types";

export class MCPManager extends EventEmitter {
  private readonly clients: Map<string, MCPClientWrapper> = new Map();
  private registry: MCPToolRegistry = {
    tools: {},
    metadata: {},
    serverStatus: {},
  };
  // Progress coordination
  private readonly progressCallbacks: Map<
    MCPProgressToken,
    MCPProgressCallback
  > = new Map();
  private readonly toolProgressTokens: Map<string, MCPProgressToken> =
    new Map();

  static parseServerConfig(configString: string): MCPServerConfig[] {
    if (!configString?.trim()) {
      console.log("⚠️ No MCP_SERVERS configured");
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
      console.log("⚠️ No MCP servers to initialize");
      return;
    }

    // Initialize new clients
    const connectionPromises = configs.map(async (config) => {
      const client = new MCPClientWrapper(config);
      this.clients.set(config.name, client);

      // Set up progress event forwarding
      client.on("progress", (notification: MCPProgressNotification) => {
        this.handleClientProgress(config.name, notification);
      });

      const connected = await client.connect();
      this.registry.serverStatus[config.name] = client.getStatus();

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
      const config = client.getConfig();

      // Add tools with server namespace
      for (const [toolName, tool] of Object.entries(tools)) {
        const namespacedName = `${serverName}_${toolName}`;
        this.registry.tools[namespacedName] = tool;
        this.registry.metadata[namespacedName] = {
          serverName,
          serverUrl: config.url,
          toolName,
          description: tool.description,
          isHealthy: client.isHealthy(),
        };
      }

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
    for (const toolName of Object.keys(this.registry.tools)) {
      if (this.registry.metadata[toolName]?.serverName === serverName) {
        delete this.registry.tools[toolName];
        delete this.registry.metadata[toolName];
      }
    }

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

  // Progress coordination methods
  private handleClientProgress(
    serverName: string,
    notification: MCPProgressNotification
  ): void {
    // Forward progress to registered callbacks
    const callback = this.progressCallbacks.get(notification.progressToken);
    if (callback) {
      try {
        callback({
          progress: notification.progress,
          total: notification.total,
          message: notification.message,
        });
      } catch (error) {
        console.warn(
          `Progress callback error for token ${notification.progressToken}:`,
          error
        );
      }
    }

    // Emit consolidated progress event
    this.emit("progress", {
      serverName,
      ...notification,
    });
  }

  generateProgressToken(serverName?: string): MCPProgressToken {
    const server = serverName || "manager";
    return `progress_${server}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  registerProgressCallback(
    token: MCPProgressToken,
    callback: MCPProgressCallback
  ): void {
    this.progressCallbacks.set(token, callback);
  }

  unregisterProgressCallback(token: MCPProgressToken): void {
    this.progressCallbacks.delete(token);
    this.toolProgressTokens.delete(token);
  }

  async executeToolWithProgress(
    toolName: string,
    args: Record<string, any>,
    options?: MCPToolCallOptions
  ): Promise<any> {
    // Parse tool name to find server (format: serverName_toolName)
    const parts = toolName.split("_");
    if (parts.length < 2) {
      throw new Error(`Invalid MCP tool name format: ${toolName}`);
    }

    const serverName = parts[0];
    const actualToolName = parts.slice(1).join("_");

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server '${serverName}' not found`);
    }

    if (!client.isHealthy()) {
      throw new Error(`MCP server '${serverName}' is not healthy`);
    }

    const progressToken =
      options?.progressToken ?? this.generateProgressToken(serverName);

    // Register progress callback at manager level
    if (options?.onProgress) {
      this.registerProgressCallback(progressToken, options.onProgress);
    }

    // Track tool-to-token mapping
    this.toolProgressTokens.set(toolName, progressToken);

    try {
      // Execute tool with progress support
      const result = await client.callToolWithProgress(actualToolName, args, {
        ...options,
        progressToken,
      });

      return result;
    } finally {
      // Clean up progress tracking
      if (options?.onProgress) {
        this.unregisterProgressCallback(progressToken);
      }
    }
  }

  getProgressState(token: MCPProgressToken): MCPProgressState | undefined {
    // Find which client has this token
    for (const client of this.clients.values()) {
      const state = client.getProgressState(token);
      if (state) {
        return state;
      }
    }
    return;
  }

  getAllProgressStates(): Map<MCPProgressToken, MCPProgressState> {
    const allStates = new Map<MCPProgressToken, MCPProgressState>();

    for (const client of this.clients.values()) {
      const clientStates = client.getAllProgressStates();
      for (const [token, state] of clientStates) {
        allStates.set(token, state);
      }
    }

    return allStates;
  }

  getActiveProgressTokens(): MCPProgressToken[] {
    return Array.from(this.getAllProgressStates().keys());
  }
}
