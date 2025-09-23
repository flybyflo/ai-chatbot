import { MCPManager } from "../mcp";
import type { MCPToolRegistry } from "../mcp/types";
import { getWeather } from "./get-weather";

interface LocalTools {
  getWeather: typeof getWeather;
}

interface CombinedToolsResult {
  tools: Record<string, any>;
  mcpRegistry?: MCPToolRegistry;
  localTools: LocalTools;
}

const localTools: LocalTools = {
  getWeather,
};

export async function getAllTools(): Promise<CombinedToolsResult> {
  const mcpServersConfig = process.env.MCP_SERVERS;

  // Always include local tools
  const result: CombinedToolsResult = {
    tools: { ...localTools },
    localTools,
  };

  // Add MCP tools if configured
  if (mcpServersConfig?.trim()) {
    try {
      const mcpManager = new MCPManager();
      const serverConfigs = MCPManager.parseServerConfig(mcpServersConfig);

      if (serverConfigs.length > 0) {
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
        "Failed to initialize MCP tools, falling back to local tools:",
        error
      );
    }
  }

  return result;
}

export async function getActiveTools(
  activeToolNames?: string[]
): Promise<Record<string, any>> {
  const { tools } = await getAllTools();

  if (!activeToolNames) {
    return tools;
  }

  const activatedTools: Record<string, any> = {};
  activeToolNames.forEach((toolName) => {
    if (tools[toolName]) {
      activatedTools[toolName] = tools[toolName];
    }
  });

  return activatedTools;
}

export { getWeather };
