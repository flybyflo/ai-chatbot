"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: mcpServers, error: swrError } = useSWR<UserMCPServer[]>(
    "/api/mcp-servers",
    fetcher
  );

  const createMCPServer = async (data: CreateMCPServerData) => {
    setIsLoading(true);
    setError(null);

    // Create optimistic server with temporary ID
    const optimisticServer: UserMCPServer = {
      id: `temp-${Date.now()}`,
      userId: "temp",
      ...data,
      isActive: true,
      toolCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Optimistically update the cache
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) => [
          optimisticServer,
          ...currentServers,
        ],
        false
      );

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

      // Replace optimistic server with real server
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.map((server) =>
            server.id === optimisticServer.id ? newServer : server
          ),
        false
      );

      return newServer;
    } catch (err) {
      // Rollback optimistic update on error
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.filter((server) => server.id !== optimisticServer.id),
        false
      );

      const message =
        err instanceof Error ? err.message : "Failed to create MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMCPServer = async (data: UpdateMCPServerData) => {
    setIsLoading(true);
    setError(null);

    // Store original server for rollback
    const originalServers = mcpServers || [];
    const originalServer = originalServers.find((s) => s.id === data.id);

    try {
      // Optimistically update the cache
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.map((server) =>
            server.id === data.id
              ? { ...server, ...data, updatedAt: new Date() }
              : server
          ),
        false
      );

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

      // Update with server response
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.map((server) =>
            server.id === data.id ? updatedServer : server
          ),
        false
      );

      return updatedServer;
    } catch (err) {
      // Rollback optimistic update on error
      if (originalServer) {
        mutate(
          "/api/mcp-servers",
          (currentServers: UserMCPServer[] = []) =>
            currentServers.map((server) =>
              server.id === data.id ? originalServer : server
            ),
          false
        );
      }

      const message =
        err instanceof Error ? err.message : "Failed to update MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMCPServer = async (id: string) => {
    setIsLoading(true);
    setError(null);

    // Store original servers for rollback
    const originalServers = mcpServers || [];

    try {
      // Optimistically remove from cache
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.filter((server) => server.id !== id),
        false
      );

      const response = await fetch("/api/mcp-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete MCP server");
      }

      return true;
    } catch (err) {
      // Rollback optimistic update on error
      mutate("/api/mcp-servers", originalServers, false);

      const message =
        err instanceof Error ? err.message : "Failed to delete MCP server";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const testMCPServer = async (
    data: TestMCPServerData
  ): Promise<TestMCPServerResult> => {
    setError(null);

    // Optimistically update server status to "testing"
    mutate(
      "/api/mcp-servers",
      (currentServers: UserMCPServer[] = []) =>
        currentServers.map((server) =>
          server.id === data.id
            ? {
                ...server,
                lastConnectionStatus: "testing",
                lastConnectionTest: new Date(),
                lastError: undefined,
              }
            : server
        ),
      false
    );

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
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.map((server) =>
            server.id === data.id ? result.server : server
          ),
        false
      );

      return result;
    } catch (err) {
      // Update with error status
      mutate(
        "/api/mcp-servers",
        (currentServers: UserMCPServer[] = []) =>
          currentServers.map((server) =>
            server.id === data.id
              ? {
                  ...server,
                  lastConnectionStatus: "failed",
                  lastError: err instanceof Error ? err.message : "Test failed",
                }
              : server
          ),
        false
      );

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
    mcpServers: mcpServers || [],
    isLoading: isLoading || !mcpServers,
    error: error || swrError?.message,
    createMCPServer,
    updateMCPServer,
    deleteMCPServer,
    testMCPServer,
    getServerTools,
    executeServerTool,
  };
}
