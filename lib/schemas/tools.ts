import { z } from "zod";

export const mcpToolMetadataSchema = z.object({
  serverName: z.string(),
  serverUrl: z.string().url(),
  toolName: z.string(),
  description: z.string().optional(),
  isHealthy: z.boolean(),
});

export const mcpServerStatusSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  isConnected: z.boolean(),
  lastError: z.string().optional(),
  toolCount: z.number(),
});

export const mcpToolRegistrySchema = z.object({
  tools: z.record(z.any()),
  metadata: z.record(mcpToolMetadataSchema),
  serverStatus: z.record(mcpServerStatusSchema),
});

const a2aAgentMetadataSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  displayName: z.string(),
  cardUrl: z.string().url(),
  description: z.string().optional(),
  isReady: z.boolean(),
  lastError: z.string().optional(),
  supportsStreaming: z.boolean().optional(),
  defaultInputModes: z.array(z.string()).optional(),
  defaultOutputModes: z.array(z.string()).optional(),
  skills: z.array(z.any()).optional(),
  documentationUrl: z.string().optional(),
  iconUrl: z.string().optional(),
});

export const a2aRegistrySchema = z.object({
  agents: z.record(a2aAgentMetadataSchema),
});

export const toolsResponseSchema = z.object({
  tools: z.array(z.string()),
  mcpRegistry: mcpToolRegistrySchema.optional(),
  a2aRegistry: a2aRegistrySchema.optional(),
});

export const serverToolsResponseSchema = z.object({
  serverId: z.string().uuid(),
  serverName: z.string(),
  tools: z.record(z.any()),
});

export type ToolsResponse = z.infer<typeof toolsResponseSchema>;
export type MCPToolRegistry = z.infer<typeof mcpToolRegistrySchema>;
export type A2AAgentRegistry = z.infer<typeof a2aRegistrySchema>;
export type ServerToolsResponse = z.infer<typeof serverToolsResponseSchema>;

export const selectedToolsSchema = z.array(z.string());

export type ToolListItem = {
  id: string;
  name: string;
  description: string;
  type: "local" | "mcp" | "a2a";
  serverName?: string;
  agentName?: string;
};
