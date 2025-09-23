import type { MCPClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient } from "ai";
import type { MCPServerConfig, MCPServerStatus } from "./types";

export class MCPClientWrapper {
  private client: MCPClient | null = null;
  private config: MCPServerConfig;
  private isConnected = false;
  private lastError: string | undefined;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url),
        {
          headers: this.config.headers || {},
        }
      );

      this.client = await experimental_createMCPClient({
        transport,
      });

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
}
