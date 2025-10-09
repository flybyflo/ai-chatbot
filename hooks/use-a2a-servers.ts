"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { fetchWithErrorHandlers } from "@/lib/utils";

export type UserA2AServer = {
  id: string;
  userId: string;
  name: string;
  cardUrl: string;
  description?: string | null;
  headers: Record<string, string>;
  isActive: boolean;
  lastConnectionTest?: string | null;
  lastConnectionStatus?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

const serializeServer = (server: any): UserA2AServer => ({
  id: server._id,
  userId: server.userId,
  name: server.name,
  cardUrl: server.cardUrl,
  description: server.description ?? null,
  headers: server.headers ?? {},
  isActive: server.isActive,
  lastConnectionTest: server.lastConnectionTest
    ? new Date(server.lastConnectionTest).toISOString()
    : null,
  lastConnectionStatus: server.lastConnectionStatus ?? null,
  lastError: server.lastError ?? null,
  createdAt: new Date(server.createdAt).toISOString(),
  updatedAt: new Date(server.updatedAt).toISOString(),
});

export function useA2AServers() {
  const session = useSession();
  const userId = session.data?.user?.id;

  const serversQuery = useQuery(
    api.queries.getUserA2AServers,
    userId ? { userId } : "skip"
  );

  const createMutation = useMutation(api.mutations.createUserA2AServer);
  const updateMutation = useMutation(api.mutations.updateUserA2AServer);
  const deleteMutation = useMutation(api.mutations.deleteUserA2AServer);

  const servers = useMemo(() => {
    if (!serversQuery) {
      return [] as UserA2AServer[];
    }

    return serversQuery.map(serializeServer);
  }, [serversQuery]);

  const createServer = async (data: {
    name: string;
    cardUrl: string;
    description?: string;
    headers?: Record<string, string>;
  }) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await createMutation({
      userId,
      name: data.name,
      cardUrl: data.cardUrl,
      description: data.description,
      headers: data.headers,
    });
  };

  const updateServer = async (data: {
    id: string;
    name?: string;
    cardUrl?: string;
    description?: string;
    headers?: Record<string, string>;
    isActive?: boolean;
    lastConnectionTest?: string | Date | null;
    lastConnectionStatus?: string;
    lastError?: string;
  }) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await updateMutation({
      id: data.id as Id<"userA2AServers">,
      userId,
      name: data.name,
      cardUrl: data.cardUrl,
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
    });
  };

  const deleteServer = async (id: string) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await deleteMutation({
      id: id as Id<"userA2AServers">,
      userId,
    });
  };

  const testServer = async (data: {
    id: string;
    cardUrl: string;
    headers?: Record<string, string>;
  }) => {
    const response = await fetchWithErrorHandlers("/api/a2a-servers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return (await response.json()) as {
      server: UserA2AServer;
      connected: boolean;
      agentCard: unknown;
    };
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
