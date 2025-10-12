"use node";
import type { Doc } from "../../../_generated/dataModel";
import { A2AManager } from "../a2a/manager";
import { buildA2ATools } from "../a2a/tools";
import type { A2AAgentRegistry } from "../a2a/types";
import { MCPManager } from "../mcp";
import type { MCPServerConfig, MCPToolRegistry } from "../mcp/types";
import { codeCompare } from "./code_compare";
import { getWeather } from "./get_weather";
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

type UserA2AServer = Doc<"userA2AServers">;
type UserMCPServer = Doc<"userMCPServers">;

const localTools: LocalTools = {
  getWeather,
  codeCompare,
  plantuml,
};

type GetAllToolsOptions = {
  convexBearer?: string;
};

export async function getAllTools(
  a2aServers?: UserA2AServer[],
  mcpServers?: UserMCPServer[],
  options?: GetAllToolsOptions
): Promise<CombinedToolsResult> {
  // Always include local tools
  const result: CombinedToolsResult = {
    tools: { ...localTools },
    localTools,
  };

  // Add user A2A and MCP tools if provided
  try {
    if (a2aServers && a2aServers.length > 0) {
      const a2aManager = new A2AManager();

      await a2aManager.initializeAgents(
        a2aServers.map((server) => ({
          id: server._id,
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

    if (mcpServers && mcpServers.length > 0) {
      const mcpManager = new MCPManager();

      // Convert user servers to MCP server configs
      const serverConfigs: MCPServerConfig[] = mcpServers.map((server) => {
        const headers: Record<string, string> = {
          ...(server.headers ?? {}),
        };

        const hasAuthHeader = Object.entries(headers).some(
          ([key, value]) =>
            key.toLowerCase() === "authorization" &&
            typeof value === "string" &&
            value.trim().length > 0
        );

        const authMode = (server.authMode ?? "convex") as "convex" | "manual";
        const hasManualToken =
          typeof server.accessToken === "string" &&
          server.accessToken.trim().length > 0;

        const removeAuthorizationVariants = () => {
          for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === "authorization") {
              delete headers[key];
            }
          }
        };

        if (authMode === "manual") {
          if (hasManualToken && !hasAuthHeader) {
            removeAuthorizationVariants();
            headers.Authorization = `Bearer ${server.accessToken}`;
          }
        } else if (options?.convexBearer && !hasAuthHeader) {
          removeAuthorizationVariants();
          headers.Authorization = options.convexBearer;
        }

        console.log("[MCP][convex] Prepared server config", {
          serverName: server.name,
          serverUrl: server.url,
          authMode,
          headerKeys: Object.keys(headers),
          hadAuthHeader: hasAuthHeader,
          usingManualToken: authMode === "manual" && hasManualToken,
          usingConvexToken:
            authMode === "convex" &&
            Boolean(options?.convexBearer) &&
            !hasAuthHeader,
          authorizationPreview: headers.Authorization
            ? `${headers.Authorization.slice(0, 20)}...`
            : undefined,
        });

        return {
          name: server.name,
          url: server.url,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        } satisfies MCPServerConfig;
      });

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

  return result;
}

export async function getActiveTools(
  activeToolNames?: string[],
  a2aServers?: UserA2AServer[],
  mcpServers?: UserMCPServer[]
): Promise<Record<string, any>> {
  const { tools } = await getAllTools(a2aServers, mcpServers);

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
