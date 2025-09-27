"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";
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

export function useMCPServers() {
  const [actionLoading, setActionLoading] = useState(false);

  // Zustand store
  const {
    servers,
    isLoading: storeLoading,
    error: storeError,
    setServers,
    setLoading,
    setError,
    addServerOptimistic,
    updateServerOptimistic,
    deleteServerOptimistic,
    setServerTesting,
    updateServerTestResult,
    confirmServerCreation,
    confirmServerUpdate,
    confirmServerDeletion,
    rollbackServerCreation,
    rollbackServerUpdate,
    rollbackServerDeletion,
  } = useMCPServerStore();

  // SWR for initial data fetching
  const {
    data: swrServers,
    error: swrError,
    isLoading: swrLoading,
  } = useSWR<UserMCPServer[]>("/api/mcp-servers", fetcher);

  // Sync SWR data with Zustand store
  useEffect(() => {
    if (swrServers && !storeLoading) {
      setServers(swrServers);
    }
  }, [swrServers, setServers, storeLoading]);

  // Set loading state from SWR
  useEffect(() => {
    setLoading(swrLoading && servers.length === 0);
  }, [swrLoading, servers.length, setLoading]);

  // Set error state from SWR
  useEffect(() => {
    setError(swrError?.message || null);
  }, [swrError, setError]);

  const createMCPServer = async (data: CreateMCPServerData) => {
    setActionLoading(true);
    setError(null);

    // Add optimistic update
    const tempId = addServerOptimistic({
      name: data.name,
      url: data.url,
      description: data.description,
      headers: data.headers,
      isActive: true,
      toolCount: 0,
    });

    try {
      const response = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create MCP server");
      }

      const newServer = await response.json();

      // Confirm optimistic update
      confirmServerCreation(tempId, newServer);

      return newServer;
    } catch (err) {
      // Rollback optimistic update
      rollbackServerCreation(tempId);

      const message =
        err instanceof Error ? err.message : "Failed to create MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const updateMCPServer = async (data: UpdateMCPServerData) => {
    setActionLoading(true);
    setError(null);

    // Store original server for rollback
    const originalServer = servers.find((s) => s.id === data.id);
    if (!originalServer) {
      throw new Error("Server not found");
    }

    // Add optimistic update
    updateServerOptimistic(data);

    try {
      const response = await fetch("/api/mcp-servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update MCP server");
      }

      const updatedServer = await response.json();

      // Confirm optimistic update
      confirmServerUpdate(data.id, updatedServer);

      return updatedServer;
    } catch (err) {
      // Rollback optimistic update
      rollbackServerUpdate(data.id, originalServer);

      const message =
        err instanceof Error ? err.message : "Failed to update MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMCPServer = async (id: string) => {
    setActionLoading(true);
    setError(null);

    // Store original server for rollback
    const originalServer = servers.find((s) => s.id === id);
    if (!originalServer) {
      throw new Error("Server not found");
    }

    // Add optimistic update
    deleteServerOptimistic(id);

    try {
      const response = await fetch("/api/mcp-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete MCP server");
      }

      // Confirm optimistic update
      confirmServerDeletion(id);

      return true;
    } catch (err) {
      // Rollback optimistic update
      rollbackServerDeletion(id, originalServer);

      const message =
        err instanceof Error ? err.message : "Failed to delete MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const testMCPServer = async (
    data: TestMCPServerData
  ): Promise<TestMCPServerResult> => {
    setError(null);

    // Set server as testing
    setServerTesting(data.id);

    try {
      const response = await fetch("/api/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to test MCP server");
      }

      const result: TestMCPServerResult = await response.json();

      // Update with test results
      updateServerTestResult(data.id, result.server);

      return result;
    } catch (err) {
      // Update with error status
      updateServerTestResult(data.id, {
        lastConnectionStatus: "failed",
        lastError: err instanceof Error ? err.message : "Test failed",
      });

      const message =
        err instanceof Error ? err.message : "Failed to test MCP server";
      setError(message);
      throw new Error(message);
    }
  };

  const getServerTools = async (serverId: string) => {
    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/tools`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch server tools");
      }

      return await response.json();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch server tools";
      setError(message);
      throw new Error(message);
    }
  };

  const executeServerTool = async (
    serverId: string,
    toolName: string,
    toolArgs?: Record<string, any>
  ) => {
    try {
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

      return await response.json();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to execute tool";
      setError(message);
      throw new Error(message);
    }
  };

  return {
    mcpServers: servers,
    isLoading: storeLoading || actionLoading,
    error: storeError,
    createMCPServer,
    updateMCPServer,
    deleteMCPServer,
    testMCPServer,
    getServerTools,
    executeServerTool,
  };
}
