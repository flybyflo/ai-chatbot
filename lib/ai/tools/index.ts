import { getActiveUserMCPServers } from "@/lib/db/queries";
import { MCPManager } from "../mcp";
import type { MCPServerConfig, MCPToolRegistry } from "../mcp/types";
import { codeCompare } from "./code-compare";
import { getWeather } from "./get-weather";
import { plantuml } from "./plantuml";

type LocalTools = {
  getWeather: typeof getWeather;
  codeCompare: typeof codeCompare;
  plantuml: typeof plantuml;
};

type CombinedToolsResult = {
  tools: Record<string, any>;
  mcpRegistry?: MCPToolRegistry;
  localTools: LocalTools;
};

const localTools: LocalTools = {
  getWeather,
  codeCompare,
  plantuml,
};

export async function getAllTools(
  userId?: string
): Promise<CombinedToolsResult> {
  // Always include local tools
  const result: CombinedToolsResult = {
    tools: { ...localTools },
    localTools,
  };

  // Add user MCP tools if userId is provided
  if (userId) {
    try {
      const userServers = await getActiveUserMCPServers(userId);

      if (userServers.length > 0) {
        const mcpManager = new MCPManager();

        // Convert user servers to MCP server configs
        const serverConfigs: MCPServerConfig[] = userServers.map((server) => ({
          name: server.name,
          url: server.url,
          headers: server.headers || {},
        }));

        await mcpManager.initializeServers(serverConfigs);
        const mcpTools = mcpManager.getTools();
        const mcpRegistry = mcpManager.getRegistry();

        // Combine local and MCP tools
        result.tools = {
          ...localTools,
          ...mcpTools,
        };
        result.mcpRegistry = mcpRegistry;
      }
    } catch (error) {
      console.warn(
        "Failed to initialize user MCP tools, falling back to local tools:",
        error
      );
    }
  }

  return result;
}

export async function getActiveTools(
  activeToolNames?: string[],
  userId?: string
): Promise<Record<string, any>> {
  const { tools } = await getAllTools(userId);

  if (!activeToolNames) {
    return tools;
  }

  const activatedTools: Record<string, any> = {};
  for (const toolName of activeToolNames) {
    if (tools[toolName]) {
      activatedTools[toolName] = tools[toolName];
    }
  }

  return activatedTools;
}

export { getWeather, codeCompare, plantuml };
