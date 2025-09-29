import {
  getActiveUserA2AServers,
  getActiveUserMCPServers,
} from "@/lib/db/queries";
import { A2AManager } from "../a2a/manager";
import { buildA2ATools } from "../a2a/tools";
import type { A2AAgentRegistry } from "../a2a/types";
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
  mcpManager?: MCPManager;
  a2aRegistry?: A2AAgentRegistry;
  a2aManager?: A2AManager;
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

  // Add user A2A and MCP tools if userId is provided
  if (userId) {
    try {
      const a2aServers = await getActiveUserA2AServers(userId);
      if (a2aServers.length > 0) {
        const a2aManager = new A2AManager();

        await a2aManager.initializeAgents(
          a2aServers.map((server) => ({
            id: server.id,
            name: server.name,
            cardUrl: server.cardUrl,
            description: server.description ?? undefined,
            headers: server.headers ?? undefined,
          }))
        );

        const { tools: a2aTools, registry } = buildA2ATools(a2aManager);

        result.tools = {
          ...result.tools,
          ...a2aTools,
        };
        result.a2aRegistry = registry;
        result.a2aManager = a2aManager;
      }

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
          ...result.tools,
          ...mcpTools,
        };
        result.mcpRegistry = mcpRegistry;
        result.mcpManager = mcpManager;
      }
    } catch (error) {
      console.warn(
        "Failed to initialize external tools, falling back to local tools:",
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
