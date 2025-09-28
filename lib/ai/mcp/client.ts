import { EventEmitter } from "node:events";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient } from "ai";
import type {
  MCPProgressCallback,
  MCPProgressState,
  MCPProgressToken,
  MCPToolCallOptions,
} from "./progress-types";
import type { MCPServerConfig, MCPServerStatus } from "./types";

export class MCPClientWrapper extends EventEmitter {
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private client: any | null = null;
  private readonly config: MCPServerConfig;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private isConnected = false;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private lastError: string | undefined;
  // Progress tracking
  private readonly progressStates: Map<MCPProgressToken, MCPProgressState> =
    new Map();
  private readonly progressCallbacks: Map<
    MCPProgressToken,
    MCPProgressCallback
  > = new Map();

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url)
      );

      this.client = await experimental_createMCPClient({
        transport,
      });

      // Set up progress notification handling
      this.setupProgressHandling();

      this.isConnected = true;
      this.lastError = undefined;
      return true;
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `Failed to connect to MCP server ${this.config.name}:`,
        error
      );
      return false;
    }
  }

  async getTools(): Promise<Record<string, any>> {
    if (!this.client || !this.isConnected) {
      return {};
    }

    try {
      const tools = await this.client.tools();
      return tools;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "Failed to fetch tools";
      console.warn(`Failed to fetch tools from ${this.config.name}:`, error);
      return {};
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn(
          `Error closing MCP client for ${this.config.name}:`,
          error
        );
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }

  getStatus(): MCPServerStatus {
    return {
      name: this.config.name,
      url: this.config.url,
      isConnected: this.isConnected,
      lastError: this.lastError,
      toolCount: 0, // Will be updated by the manager
    };
  }

  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  isHealthy(): boolean {
    return this.isConnected && !this.lastError;
  }

  // Progress handling methods
  private setupProgressHandling(): void {
    if (!this.client) {
      return;
    }

    // Check if the client supports progress notifications
    try {
      // The AI SDK's experimental_createMCPClient may not expose onNotification directly
      // For now, we'll rely on polling progress state during tool execution
      console.log(
        `Progress notifications setup attempted for ${this.config.name}`
      );

      // TODO: When AI SDK supports progress notifications, implement here
      // if (typeof this.client.onNotification === 'function') {
      //   this.client.onNotification(
      //     "notifications/progress",
      //     (params: MCPProgressNotification) => {
      //       this.handleProgressNotification(params);
      //     }
      //   );
      // }
    } catch (error) {
      console.warn(
        `Progress notification setup not available for ${this.config.name}:`,
        error
      );
    }
  }

  generateProgressToken(): MCPProgressToken {
    return `progress_${this.config.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  registerProgressCallback(
    token: MCPProgressToken,
    callback: MCPProgressCallback
  ): void {
    this.progressCallbacks.set(token, callback);
  }

  unregisterProgressCallback(token: MCPProgressToken): void {
    this.progressCallbacks.delete(token);
    this.progressStates.delete(token);
  }

  getProgressState(token: MCPProgressToken): MCPProgressState | undefined {
    return this.progressStates.get(token);
  }

  getAllProgressStates(): Map<MCPProgressToken, MCPProgressState> {
    return new Map(this.progressStates);
  }

  async callToolWithProgress(
    toolName: string,
    args: Record<string, any>,
    options?: MCPToolCallOptions
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error(`MCP client for ${this.config.name} is not connected`);
    }

    const progressToken =
      options?.progressToken ?? this.generateProgressToken();

    // Register progress callback if provided
    if (options?.onProgress) {
      this.registerProgressCallback(progressToken, options.onProgress);
    }

    try {
      // The AI SDK's experimental_createMCPClient returns tools that can be called
      // We need to check the actual tool calling interface
      const tools = await this.getTools();
      const tool = tools[toolName];

      if (!tool) {
        throw new Error(
          `Tool '${toolName}' not found on server ${this.config.name}`
        );
      }

      // For now, simulate progress since the AI SDK integration doesn't support
      // MCP progress notifications yet
      if (options?.onProgress) {
        // Simulate start progress
        options.onProgress({
          progress: 0,
          total: 100,
          message: `Starting ${toolName}...`,
        });

        // Simulate intermediate progress
        setTimeout(() => {
          options.onProgress?.({
            progress: 50,
            total: 100,
            message: `Processing ${toolName}...`,
          });
        }, 100);
      }

      // Since the AI SDK handles tool execution differently,
      // we'll return the tool definition for now
      // The actual execution will happen through the AI SDK's streamText
      const result = {
        toolName,
        arguments: args,
        progressToken,
        // TODO: Replace with actual tool execution when AI SDK supports it
        message: `Tool ${toolName} would be executed with args: ${JSON.stringify(args)}`,
      };

      // Simulate completion progress
      if (options?.onProgress) {
        setTimeout(() => {
          options.onProgress?.({
            progress: 100,
            total: 100,
            message: `Completed ${toolName}`,
          });
        }, 200);
      }

      return result;
    } finally {
      // Clean up progress tracking after a delay to allow final progress update
      if (options?.onProgress) {
        setTimeout(() => {
          this.unregisterProgressCallback(progressToken);
        }, 300);
      }
    }
  }
}
