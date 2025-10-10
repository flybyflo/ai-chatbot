import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
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

type RegistrySnapshot = Doc<"userMCPRegistrySnapshots">;

const localTools: LocalTools = {
  getWeather,
  codeCompare,
  plantuml,
};

function cloneRegistry(registry: MCPToolRegistry): MCPToolRegistry {
  return {
    tools: { ...registry.tools },
    metadata: { ...registry.metadata },
    serverStatus: { ...registry.serverStatus },
  };
}

function mergeRegistries(
  base?: MCPToolRegistry,
  override?: MCPToolRegistry
): MCPToolRegistry | undefined {
  if (!base) {
    return override ? cloneRegistry(override) : undefined;
  }

  if (!override) {
    return cloneRegistry(base);
  }

  const merged = cloneRegistry(base);

  for (const [toolId, tool] of Object.entries(override.tools)) {
    merged.tools[toolId] = tool;
  }

  for (const [toolId, metadata] of Object.entries(override.metadata)) {
    merged.metadata[toolId] = metadata;
  }

  for (const [serverName, status] of Object.entries(override.serverStatus)) {
    merged.serverStatus[serverName] = status;
  }

  return merged;
}

function aggregateSnapshotRegistries(
  snapshots: RegistrySnapshot[]
): MCPToolRegistry | undefined {
  return snapshots.reduce<MCPToolRegistry | undefined>((acc, snapshot) => {
    return mergeRegistries(acc, snapshot.registry);
  }, undefined);
}

function mergeSnapshotWithServerRegistry(
  snapshot: RegistrySnapshot | undefined,
  serverRegistry: MCPToolRegistry
): MCPToolRegistry {
  if (!snapshot) {
    return cloneRegistry(serverRegistry);
  }

  const hasMetadata = Object.keys(serverRegistry.metadata).length > 0;
  const mergedStatus = {
    ...snapshot.registry.serverStatus,
    ...serverRegistry.serverStatus,
  };

  if (!hasMetadata) {
    return {
      tools: { ...snapshot.registry.tools },
      metadata: { ...snapshot.registry.metadata },
      serverStatus: mergedStatus,
    };
  }

  return {
    tools: { ...snapshot.registry.tools, ...serverRegistry.tools },
    metadata: { ...snapshot.registry.metadata, ...serverRegistry.metadata },
    serverStatus: mergedStatus,
  };
}

async function fetchServers<T extends Doc<any>>(fetcher: () => Promise<T[]>) {
  try {
    return await fetcher();
  } catch (error) {
    console.warn("Failed to load user servers", error);
    return [];
  }
}

export async function getAllTools(
  userId?: string,
  token?: string
): Promise<CombinedToolsResult> {
  // Always include local tools
  const result: CombinedToolsResult = {
    tools: { ...localTools },
    localTools,
  };

  // Add user A2A and MCP tools if userId is provided
  if (userId && token) {
    try {
      const [a2aServers, mcpServers, registrySnapshots] = await Promise.all([
        fetchServers(() =>
          fetchQuery(api.queries.getActiveUserA2AServers, { userId }, { token })
        ),
        fetchServers(() =>
          fetchQuery(api.queries.getActiveUserMCPServers, { userId }, { token })
        ),
        fetchServers(() =>
          fetchQuery(
            api.queries.getUserMCPRegistrySnapshots,
            { userId },
            { token }
          )
        ),
      ]);

      const snapshotByServerId = new Map<string, RegistrySnapshot>();
      for (const snapshot of registrySnapshots) {
        snapshotByServerId.set(snapshot.serverId as string, snapshot);
      }

      let aggregatedRegistry = aggregateSnapshotRegistries(registrySnapshots);
      if (aggregatedRegistry) {
        result.mcpRegistry = aggregatedRegistry;
      }

      if (a2aServers.length > 0) {
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

      if (mcpServers.length > 0) {
        const mcpManager = new MCPManager();

        // Convert user servers to MCP server configs
        const serverConfigs: MCPServerConfig[] = mcpServers.map((server) => ({
          name: server.name,
          url: server.url,
          headers: server.headers || {},
        }));

        await mcpManager.initializeServers(serverConfigs);
        const mcpTools = mcpManager.getTools();
        const mcpRegistry = mcpManager.getSerializableRegistry();
        const registryByServer = mcpManager.getSerializableRegistryByServer();

        // Combine local and MCP tools
        result.tools = {
          ...result.tools,
          ...mcpTools,
        };
        aggregatedRegistry = mergeRegistries(aggregatedRegistry, mcpRegistry);
        if (aggregatedRegistry) {
          result.mcpRegistry = aggregatedRegistry;
        }
        result.mcpManager = mcpManager;

        const persistPromises = mcpServers
          .map((server) => {
            const serverRegistry = registryByServer[server.name];
            if (!serverRegistry) {
              return null;
            }

            const snapshot = snapshotByServerId.get(server._id as string);
            const registryToPersist = mergeSnapshotWithServerRegistry(
              snapshot,
              serverRegistry
            );

            return fetchMutation(
              api.mutations.upsertUserMCPRegistrySnapshot,
              {
                userId,
                serverId: server._id,
                registry: registryToPersist,
              },
              { token }
            );
          })
          .filter((promise): promise is Promise<any> => promise !== null);

        if (persistPromises.length > 0) {
          await Promise.allSettled(persistPromises);
        }
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
  userId?: string,
  token?: string
): Promise<Record<string, any>> {
  const { tools } = await getAllTools(userId, token);

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
