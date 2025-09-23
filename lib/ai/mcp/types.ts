export interface MCPServerConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
}

export interface MCPToolMetadata {
  serverName: string;
  serverUrl: string;
  toolName: string;
  description?: string;
  isHealthy: boolean;
}

export interface MCPServerStatus {
  name: string;
  url: string;
  isConnected: boolean;
  lastError?: string;
  toolCount: number;
}

export interface MCPToolRegistry {
  tools: Record<string, any>;
  metadata: Record<string, MCPToolMetadata>;
  serverStatus: Record<string, MCPServerStatus>;
}
