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

export const toolsResponseSchema = z.object({
  tools: z.array(z.string()),
  mcpRegistry: mcpToolRegistrySchema.optional(),
});

export const serverToolsResponseSchema = z.object({
  serverId: z.string().uuid(),
  serverName: z.string(),
  tools: z.record(z.any()),
});

export type ToolsResponse = z.infer<typeof toolsResponseSchema>;
export type MCPToolRegistry = z.infer<typeof mcpToolRegistrySchema>;
export type ServerToolsResponse = z.infer<typeof serverToolsResponseSchema>;

export const selectedToolsSchema = z.array(z.string());

export type ToolListItem = {
  id: string;
  name: string;
  description: string;
  type: "local" | "mcp";
  serverName?: string;
};
