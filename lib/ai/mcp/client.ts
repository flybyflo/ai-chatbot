import { EventEmitter } from "node:events";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient } from "ai";
import type { MCPServerConfig, MCPServerStatus } from "./types";

export class MCPClientWrapper extends EventEmitter {
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private client: any | null = null;
  private readonly config: MCPServerConfig;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private isConnected = false;
  // biome-ignore lint/style/useReadonlyClassProperties: Properties are reassigned in methods
  private lastError: string | undefined;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url),
        this.config.headers && Object.keys(this.config.headers).length > 0
          ? { requestInit: { headers: this.config.headers } }
          : undefined
      );

      if (this.config.headers?.Authorization) {
        console.log("[MCP][client] Connecting with authorization", {
          serverName: this.config.name,
          url: this.config.url,
          authorizationPreview: `${String(this.config.headers.Authorization).slice(0, 20)}...`,
        });
      } else {
        console.log("[MCP][client] Connecting without authorization header", {
          serverName: this.config.name,
          url: this.config.url,
          headerKeys: Object.keys(this.config.headers ?? {}),
        });
      }

      this.client = await experimental_createMCPClient({
        transport,
      });

      this.isConnected = true;
      this.lastError = undefined;
      return true;
    } catch (error) {
      this.isConnected = false;
      if (typeof (error as any)?.response === "object") {
        const response = (error as any).response as Response;
        let bodyText: string | undefined;
        try {
          bodyText = await response.text();
        } catch (bodyError) {
          console.warn(
            `[MCP][client] Failed to read error body for ${this.config.name}:`,
            bodyError
          );
        }
        console.warn(
          `[MCP][client] HTTP error details for ${this.config.name}:`,
          {
            status: (response as any).status,
            statusText: (response as any).statusText,
            body: bodyText,
          }
        );
      }
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
