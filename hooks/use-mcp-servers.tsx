"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetcher } from "@/lib/utils";

export type UserMCPServer = {
  id: string;
  userId: string;
  name: string;
  url: string;
  description?: string;
  headers?: Record<string, string>;
  isActive: boolean;
  lastConnectionTest?: Date;
  lastConnectionStatus?: string;
  lastError?: string;
  toolCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

type CreateMCPServerData = {
  name: string;
  url: string;
  description?: string;
  headers?: Record<string, string>;
};

type UpdateMCPServerData = {
  id: string;
  name?: string;
  url?: string;
  description?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  lastConnectionTest?: Date;
  lastConnectionStatus?: string;
  lastError?: string;
  toolCount?: number;
};

type TestMCPServerData = {
  id: string;
  url: string;
  headers?: Record<string, string>;
};

type TestMCPServerResult = {
  server: UserMCPServer;
  tools: Record<string, any>;
  connected: boolean;
};

const QUERY_KEY = ["mcp-servers"];

export function useMCPServers() {
  const queryClient = useQueryClient();
  // Zustand cache for instant initial data
  const { useMCPServerStore } = require("@/lib/stores/mcp-server-store");
  const setServersCache = useMCPServerStore.getState().setServers as (
    servers: UserMCPServer[]
  ) => void;

  // Query for fetching MCP servers
  const {
    data: mcpServers = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetcher("/api/mcp-servers")) as UserMCPServer[],
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  // Create server mutation with optimistic updates
  const createServerMutation = useMutation({
    mutationFn: async (data: CreateMCPServerData): Promise<UserMCPServer> => {
      const response = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create MCP server");
      }

      return response.json();
    },
    onMutate: async (newServer) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousServers =
        queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY);

      // Optimistically add server
      const optimisticServer: UserMCPServer = {
        id: `temp-${Date.now()}`,
        userId: "temp",
        name: newServer.name,
        url: newServer.url,
        description: newServer.description,
        headers: newServer.headers,
        isActive: true,
        lastConnectionStatus: "pending",
        toolCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) => [
        optimisticServer,
        ...old,
      ]);

      return { previousServers, optimisticServer };
    },
    onError: (_err, _newServer, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, context.previousServers);
      }
    },
    onSuccess: (data, _variables, context) => {
      // Update the optimistic server with real data
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.map((server) =>
          server.id === context?.optimisticServer.id ? data : server
        )
      );
      setServersCache(
        (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
          []) as UserMCPServer[]
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
        []) as UserMCPServer[];
      setServersCache(latest);
    },
  });

  // Update server mutation
  const updateServerMutation = useMutation({
    mutationFn: async (data: UpdateMCPServerData): Promise<UserMCPServer> => {
      const response = await fetch("/api/mcp-servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update MCP server");
      }

      return response.json();
    },
    onMutate: async (updatedServer) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousServers =
        queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY);

      // Optimistically update
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.map((server) =>
          server.id === updatedServer.id
            ? { ...server, ...updatedServer, updatedAt: new Date() }
            : server
        )
      );

      return { previousServers };
    },
    onError: (_err, _updatedServer, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
        []) as UserMCPServer[];
      setServersCache(latest);
    },
  });

  // Delete server mutation
  const deleteServerMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch("/api/mcp-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete MCP server");
      }
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousServers =
        queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY);

      // Optimistically remove
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.filter((server) => server.id !== deletedId)
      );

      return { previousServers };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
        []) as UserMCPServer[];
      setServersCache(latest);
    },
  });

  // Test server mutation
  const testServerMutation = useMutation({
    mutationFn: async (
      data: TestMCPServerData
    ): Promise<TestMCPServerResult> => {
      const response = await fetch("/api/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to test MCP server");
      }

      return response.json();
    },
    onMutate: async (testData) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousServers =
        queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY);

      // Optimistically set testing status
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.map((server) =>
          server.id === testData.id
            ? {
                ...server,
                lastConnectionStatus: "testing",
                lastConnectionTest: new Date(),
                lastError: undefined,
              }
            : server
        )
      );

      return { previousServers };
    },
    onSuccess: (result) => {
      // Update with test results
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.map((server) =>
          server.id === result.server.id ? result.server : server
        )
      );
      setServersCache(
        (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
          []) as UserMCPServer[]
      );
    },
    onError: (err, testData, _context) => {
      // Update with error status
      queryClient.setQueryData<UserMCPServer[]>(QUERY_KEY, (old = []) =>
        old.map((server) =>
          server.id === testData.id
            ? {
                ...server,
                lastConnectionStatus: "failed",
                lastError: err instanceof Error ? err.message : "Test failed",
              }
            : server
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserMCPServer[]>(QUERY_KEY) ||
        []) as UserMCPServer[];
      setServersCache(latest);
    },
  });

  // Get server tools
  const getServerTools = async (serverId: string) => {
    const response = await fetch(`/api/mcp-servers/${serverId}/tools`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch server tools");
    }

    return response.json();
  };

  // Execute server tool
  const executeServerTool = async (
    serverId: string,
    toolName: string,
    toolArgs?: Record<string, any>
  ) => {
    const response = await fetch(`/api/mcp-servers/${serverId}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName,
        arguments: toolArgs,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to execute tool");
    }

    return response.json();
  };

  return {
    mcpServers,
    isLoading,
    isFetching,
    hasCached: dataUpdatedAt > 0,
    error: error?.message || null,
    createMCPServer: createServerMutation.mutateAsync,
    updateMCPServer: updateServerMutation.mutateAsync,
    deleteMCPServer: deleteServerMutation.mutateAsync,
    testMCPServer: testServerMutation.mutateAsync,
    getServerTools,
    executeServerTool,
    isCreating: createServerMutation.isPending,
    isUpdating: updateServerMutation.isPending,
    isDeleting: deleteServerMutation.isPending,
    isTesting: testServerMutation.isPending,
  };
}
