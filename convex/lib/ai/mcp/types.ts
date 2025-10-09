export type MCPServerConfig = {
  name: string;
  url: string;
  headers?: Record<string, string>;
};

export type MCPToolMetadata = {
  serverName: string;
  serverUrl: string;
  toolName: string;
  description?: string;
  isHealthy: boolean;
};

export type MCPServerStatus = {
  name: string;
  url: string;
  isConnected: boolean;
  lastError?: string;
  toolCount: number;
};

export type MCPToolRegistry = {
  tools: Record<string, any>;
  metadata: Record<string, MCPToolMetadata>;
  serverStatus: Record<string, MCPServerStatus>;
};
