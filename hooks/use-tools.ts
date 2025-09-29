"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  type A2AAgentRegistry,
  type MCPToolRegistry,
  type ServerToolsResponse,
  selectedToolsSchema,
  serverToolsResponseSchema,
  type ToolListItem,
  type ToolsResponse,
  toolsResponseSchema,
} from "@/lib/schemas/tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";
import { fetcher } from "@/lib/utils";

const TOOLS_QUERY_KEY = ["tools", "all"] as const;

export function useAllTools() {
  const query = useQuery<ToolsResponse, Error>({
    queryKey: TOOLS_QUERY_KEY,
    queryFn: async () => {
      const data = (await fetcher("/api/tools")) as unknown;
      return toolsResponseSchema.parse(data);
    },
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });

  const list: ToolListItem[] = useMemo(() => {
    const localToolIds = ["getWeather", "codeCompare", "plantuml"];
    const localTools: ToolListItem[] = localToolIds.map((id) => ({
      id,
      name:
        id === "getWeather"
          ? "Get Weather"
          : id === "codeCompare"
            ? "Code Compare"
            : "PlantUML Diagram",
      description:
        id === "getWeather"
          ? "Get current weather information for a location"
          : id === "codeCompare"
            ? "Render a side-by-side comparison given filename, before and after code"
            : "Create and render PlantUML diagrams with source code viewer",
      type: "local",
    }));

    const mcpTools: ToolListItem[] = query.data?.mcpRegistry?.metadata
      ? Object.entries(query.data.mcpRegistry.metadata).map(
          ([toolId, metadata]) => ({
            id: toolId,
            name: metadata.toolName || toolId,
            description: metadata.description || "MCP tool",
            type: "mcp" as const,
            serverName: metadata.serverName,
          })
        )
      : [];

    const sanitizeAgentKey = (key: string) =>
      key.replace(/[^a-zA-Z0-9_-]/g, "_");

    const a2aTools: ToolListItem[] = query.data?.a2aRegistry
      ? Object.entries(query.data.a2aRegistry.agents).map(
          ([agentKey, metadata]) => {
            const toolId =
              metadata.toolId || `a2a_${sanitizeAgentKey(agentKey)}`;
            return {
              id: toolId,
              name: metadata.displayName,
              description:
                metadata.description ||
                "Send a task to your configured A2A agent",
              type: "a2a" as const,
              agentName: metadata.displayName,
            };
          }
        )
      : [];

    return [...localTools, ...mcpTools, ...a2aTools];
  }, [query.data]);

  return {
    tools: list,
    mcpRegistry: query.data?.mcpRegistry as MCPToolRegistry | undefined,
    a2aRegistry: query.data?.a2aRegistry as A2AAgentRegistry | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isReady: Boolean(query.data),
    error: query.error?.message || null,
  };
}

export function useMCPServerTools(serverId: string | undefined) {
  const query = useQuery<ServerToolsResponse, Error>({
    queryKey: ["tools", "server", serverId],
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = (await fetcher(
        `/api/mcp-servers/${serverId}/tools`
      )) as unknown;
      return serverToolsResponseSchema.parse(data);
    },
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data,
    tools: query.data?.tools || {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message || null,
  };
}

// Hook to validate and persist selected tools in cache (React Query) instead of component localStorage
export function useSelectedTools(
  selectedTools: string[] | undefined,
  onValidSelection?: (tools: string[]) => void
) {
  const queryClient = useQueryClient();
  const { tools: allTools, isLoading, isFetching } = useAllTools();
  const setSelectedTools = useMCPServerStore((s) => s.setSelectedTools);

  useEffect(() => {
    if (!selectedTools) {
      return;
    }
    // Avoid deactivating MCP tools before the registry has loaded
    if (isLoading || isFetching) {
      return;
    }
    const normalizeToolId = (toolId: string) =>
      toolId.startsWith("a2a::") ? `a2a_${toolId.slice(5)}` : toolId;

    const normalizedSelection = selectedTools.map(normalizeToolId);
    const normalizationChanged = normalizedSelection.some(
      (id, index) => id !== selectedTools[index]
    );

    const availableIds = new Set(allTools.map((t) => t.id));
    const filteredSelection = normalizedSelection.filter((t) =>
      availableIds.has(t)
    );

    if (
      filteredSelection.length !== selectedTools.length ||
      normalizationChanged
    ) {
      onValidSelection?.(filteredSelection);
    }

    const parsed = selectedToolsSchema.parse(filteredSelection);
    // Keep a cache entry for last selected tools
    queryClient.setQueryData(["tools", "selected"], parsed);
    // Persist via Zustand store
    setSelectedTools(parsed);
  }, [
    selectedTools,
    allTools,
    isLoading,
    isFetching,
    queryClient,
    onValidSelection,
    setSelectedTools,
  ]);

  return {
    getCachedSelected: () => {
      const storeSelected = useMCPServerStore.getState().selectedTools;
      if (storeSelected && storeSelected.length > 0) {
        return storeSelected;
      }
      return (
        (queryClient.getQueryData(["tools", "selected"]) as string[]) || []
      );
    },
  };
}
