"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { fetchWithErrorHandlers } from "@/lib/utils";

export type UserMCPServer = {
  id: string;
  userId: string;
  name: string;
  url: string;
  description?: string | null;
  headers: Record<string, string>;
  isActive: boolean;
  lastConnectionTest?: string | null;
  lastConnectionStatus?: string | null;
  lastError?: string | null;
  toolCount?: number | null;
  createdAt: string;
  updatedAt: string;
};

const serializeServer = (server: any): UserMCPServer => ({
  id: server._id,
  userId: server.userId,
  name: server.name,
  url: server.url,
  description: server.description ?? null,
  headers: server.headers ?? {},
  isActive: server.isActive,
  lastConnectionTest: server.lastConnectionTest
    ? new Date(server.lastConnectionTest).toISOString()
    : null,
  lastConnectionStatus: server.lastConnectionStatus ?? null,
  lastError: server.lastError ?? null,
  toolCount: server.toolCount ?? null,
  createdAt: new Date(server.createdAt).toISOString(),
  updatedAt: new Date(server.updatedAt).toISOString(),
});

export function useMCPServers() {
  const session = useSession();
  const userId = session.data?.user?.id;

  const serversQuery = useQuery(
    api.queries.getUserMCPServers,
    userId ? { userId } : "skip"
  );

  const createMutation = useMutation(api.mutations.createUserMCPServer);
  const updateMutation = useMutation(api.mutations.updateUserMCPServer);
  const deleteMutation = useMutation(api.mutations.deleteUserMCPServer);

  const servers = useMemo(() => {
    if (!serversQuery) {
      return [] as UserMCPServer[];
    }

    return serversQuery.map(serializeServer);
  }, [serversQuery]);

  const createServer = async (data: {
    name: string;
    url: string;
    description?: string;
    headers?: Record<string, string>;
  }) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await createMutation({
      userId,
      name: data.name,
      url: data.url,
      description: data.description,
      headers: data.headers,
    });
  };

  const updateServer = async (data: {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    headers?: Record<string, string>;
    isActive?: boolean;
    lastConnectionTest?: string | Date | null;
    lastConnectionStatus?: string;
    lastError?: string;
    toolCount?: number;
  }) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await updateMutation({
      id: data.id as Id<"userMCPServers">,
      userId,
      name: data.name,
      url: data.url,
      description: data.description,
      headers: data.headers,
      isActive: data.isActive,
      lastConnectionTest: data.lastConnectionTest
        ? typeof data.lastConnectionTest === "string"
          ? new Date(data.lastConnectionTest).getTime()
          : data.lastConnectionTest.getTime()
        : undefined,
      lastConnectionStatus: data.lastConnectionStatus,
      lastError: data.lastError,
      toolCount: data.toolCount,
    });
  };

  const deleteServer = async (id: string) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await deleteMutation({
      id: id as Id<"userMCPServers">,
      userId,
    });
  };

  const testServer = async (data: {
    id: string;
    url: string;
    headers?: Record<string, string>;
  }) => {
    try {
      const response = await fetchWithErrorHandlers("/api/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      return (await response.json()) as {
        server: UserMCPServer;
        tools: Record<string, unknown>;
        connected: boolean;
      };
    } catch (error) {
      // Re-throw with better error information
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to test MCP server");
    }
  };

  return {
    servers,
    isLoading: serversQuery === undefined,
    createServer,
    updateServer,
    deleteServer,
    testServer,
  };
}
