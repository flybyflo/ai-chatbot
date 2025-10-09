"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { LOCAL_TOOL_IDS } from "@/lib/enums";
import {
  selectedToolsSchema,
  serverToolsResponseSchema,
  type ToolListItem,
  toolsResponseSchema,
} from "@/lib/schemas/tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";
import { fetcher } from "@/lib/utils";

type ToolsResponse = ReturnType<typeof toolsResponseSchema.parse>;

type ServerToolsResponse = ReturnType<typeof serverToolsResponseSchema.parse>;

export function useAllTools() {
  const { data, error, isLoading, isValidating } = useSWR<ToolsResponse>(
    "/api/tools",
    async (url) => {
      const raw = await fetcher(url);
      return toolsResponseSchema.parse(raw);
    }
  );

  const list: ToolListItem[] = useMemo(() => {
    const localToolIds = [
      LOCAL_TOOL_IDS.GET_WEATHER,
      LOCAL_TOOL_IDS.CODE_COMPARE,
      LOCAL_TOOL_IDS.PLANTUML,
    ];

    const localTools: ToolListItem[] = localToolIds.map((id) => ({
      id,
      name:
        id === LOCAL_TOOL_IDS.GET_WEATHER
          ? "Get Weather"
          : id === LOCAL_TOOL_IDS.CODE_COMPARE
            ? "Code Compare"
            : "PlantUML Diagram",
      description:
        id === LOCAL_TOOL_IDS.GET_WEATHER
          ? "Get current weather information for a location"
          : id === LOCAL_TOOL_IDS.CODE_COMPARE
            ? "Render a side-by-side comparison given filename, before and after code"
            : "Create and render PlantUML diagrams with source code viewer",
      type: "local",
    }));

    const mcpTools: ToolListItem[] = data?.mcpRegistry?.metadata
      ? Object.entries(data.mcpRegistry.metadata).map(([toolId, metadata]) => ({
          id: toolId,
          name: metadata.toolName || toolId,
          description: metadata.description || "MCP tool",
          type: "mcp" as const,
          serverName: metadata.serverName,
        }))
      : [];

    const sanitizeAgentKey = (key: string) =>
      key.replace(/[^a-zA-Z0-9_-]/g, "_");

    const a2aTools: ToolListItem[] = data?.a2aRegistry
      ? Object.entries(data.a2aRegistry.agents).map(([agentKey, metadata]) => {
          const toolId = metadata.toolId || `a2a_${sanitizeAgentKey(agentKey)}`;
          return {
            id: toolId,
            name: metadata.displayName,
            description:
              metadata.description ||
              "Send a task to your configured A2A agent",
            type: "a2a" as const,
            agentName: metadata.displayName,
          };
        })
      : [];

    return [...localTools, ...mcpTools, ...a2aTools];
  }, [data]);

  return {
    tools: list,
    mcpRegistry: data?.mcpRegistry,
    a2aRegistry: data?.a2aRegistry,
    isLoading,
    isFetching: isValidating,
    error: error?.message ?? null,
    isReady: Boolean(data),
  };
}

export function useMCPServerTools(serverId: string | undefined) {
  const { data, error, isLoading, isValidating } = useSWR<ServerToolsResponse>(
    serverId ? `/api/mcp-servers/${serverId}/tools` : null,
    async (url) => {
      const raw = await fetcher(url);
      return serverToolsResponseSchema.parse(raw);
    }
  );

  return {
    data,
    tools: data?.tools || {},
    isLoading,
    isFetching: isValidating,
    error: error?.message ?? null,
  };
}

export function useSelectedTools(
  selectedTools: string[] | undefined,
  onValidSelection?: (tools: string[]) => void
) {
  const setSelectedTools = useMCPServerStore((s) => s.setSelectedTools);

  useEffect(() => {
    if (!selectedTools) {
      return;
    }

    try {
      const parsed = selectedToolsSchema.parse(selectedTools);
      onValidSelection?.(parsed);
      setSelectedTools(parsed);
    } catch {
      onValidSelection?.([]);
      setSelectedTools([]);
    }
  }, [selectedTools, onValidSelection, setSelectedTools]);

  return {
    getCachedSelected: () => {
      const storeSelected = useMCPServerStore.getState().selectedTools;
      if (storeSelected && storeSelected.length > 0) {
        return storeSelected;
      }
      return [];
    },
  };
}
