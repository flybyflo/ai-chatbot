"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/enums";
import { fetcher } from "@/lib/utils";

export type UserA2AServer = {
  id: string;
  userId: string;
  name: string;
  cardUrl: string;
  description?: string;
  headers?: Record<string, string>;
  isActive: boolean;
  lastConnectionTest?: Date;
  lastConnectionStatus?: string;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

type CreateA2AServerData = {
  name: string;
  cardUrl: string;
  description?: string;
  headers?: Record<string, string>;
};

type UpdateA2AServerData = {
  id: string;
  name?: string;
  cardUrl?: string;
  description?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
  lastConnectionTest?: Date;
  lastConnectionStatus?: string;
  lastError?: string;
};

type TestA2AServerData = {
  id: string;
  cardUrl: string;
  headers?: Record<string, string>;
};

type TestA2AServerResult = {
  server: UserA2AServer;
  connected: boolean;
  agentCard?: any;
};

const QUERY_KEY = QUERY_KEYS.A2A_SERVERS;

export function useA2AServers() {
  const queryClient = useQueryClient();
  const { useA2AServerStore } = require("@/lib/stores/a2a-server-store");
  const setServersCache = useA2AServerStore.getState().setServers as (
    servers: UserA2AServer[]
  ) => void;

  const {
    data: a2aServers = [],
    isLoading,
    isFetching,
    dataUpdatedAt,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetcher("/api/a2a-servers")) as UserA2AServer[],
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  const createServer = useMutation({
    mutationFn: async (data: CreateA2AServerData): Promise<UserA2AServer> => {
      const response = await fetch("/api/a2a-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create A2A server");
      }
      return response.json();
    },
    onMutate: async (newServer) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousServers =
        queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY);
      const optimistic: UserA2AServer = {
        id: `temp-${Date.now()}`,
        userId: "temp",
        name: newServer.name,
        cardUrl: newServer.cardUrl,
        description: newServer.description,
        headers: newServer.headers,
        isActive: true,
        lastConnectionStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as UserA2AServer;
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previousServers, optimistic };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, ctx.previousServers);
      }
    },
    onSuccess: (data, _vars, ctx) => {
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.map((s) => (s.id === ctx?.optimistic.id ? data : s))
      );
      setServersCache(
        (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
          []) as UserA2AServer[]
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
        []) as UserA2AServer[];
      setServersCache(latest);
    },
  });

  const updateServer = useMutation({
    mutationFn: async (data: UpdateA2AServerData): Promise<UserA2AServer> => {
      const response = await fetch("/api/a2a-servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update A2A server");
      }
      return response.json();
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousServers =
        queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY);
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.map((s) =>
          s.id === updated.id ? { ...s, ...updated, updatedAt: new Date() } : s
        )
      );
      return { previousServers };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, ctx.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
        []) as UserA2AServer[];
      setServersCache(latest);
    },
  });

  const deleteServer = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch("/api/a2a-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete A2A server");
      }
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousServers =
        queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY);
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.filter((s) => s.id !== deletedId)
      );
      return { previousServers };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousServers) {
        queryClient.setQueryData(QUERY_KEY, ctx.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
        []) as UserA2AServer[];
      setServersCache(latest);
    },
  });

  const testServer = useMutation({
    mutationFn: async (
      data: TestA2AServerData
    ): Promise<TestA2AServerResult> => {
      const response = await fetch("/api/a2a-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to test A2A server");
      }
      return response.json();
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousServers =
        queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY);
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.map((s) =>
          s.id === data.id
            ? {
                ...s,
                lastConnectionStatus: "testing",
                lastConnectionTest: new Date(),
                lastError: undefined,
              }
            : s
        )
      );
      return { previousServers };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.map((s) => (s.id === result.server.id ? result.server : s))
      );
      setServersCache(
        (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
          []) as UserA2AServer[]
      );
    },
    onError: (err, data) => {
      queryClient.setQueryData<UserA2AServer[]>(QUERY_KEY, (old = []) =>
        old.map((s) =>
          s.id === data.id
            ? {
                ...s,
                lastConnectionStatus: "failed",
                lastError: err instanceof Error ? err.message : "Test failed",
              }
            : s
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const latest = (queryClient.getQueryData<UserA2AServer[]>(QUERY_KEY) ||
        []) as UserA2AServer[];
      setServersCache(latest);
    },
  });

  return {
    a2aServers,
    isLoading,
    isFetching,
    hasCached: dataUpdatedAt > 0,
    error: error?.message || null,
    createA2AServer: createServer.mutateAsync,
    updateA2AServer: updateServer.mutateAsync,
    deleteA2AServer: deleteServer.mutateAsync,
    testA2AServer: testServer.mutateAsync,
    isCreating: createServer.isPending,
    isUpdating: updateServer.isPending,
    isDeleting: deleteServer.isPending,
    isTesting: testServer.isPending,
  };
}
