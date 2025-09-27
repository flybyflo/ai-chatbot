import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UserMCPServer } from "@/hooks/use-mcp-servers";

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

interface MCPServerState {
  // State
  servers: UserMCPServer[];
  isLoading: boolean;
  error: string | null;
  optimisticUpdates: Set<string>;
  testingServers: Set<string>;

  // Actions
  setServers: (servers: UserMCPServer[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // CRUD operations with optimistic updates
  addServerOptimistic: (
    server: Omit<UserMCPServer, "id" | "userId" | "createdAt" | "updatedAt">
  ) => string;
  updateServerOptimistic: (data: UpdateMCPServerData) => void;
  deleteServerOptimistic: (id: string) => void;

  // Testing operations
  setServerTesting: (id: string) => void;
  updateServerTestResult: (id: string, result: Partial<UserMCPServer>) => void;

  // Confirm operations (called after successful API response)
  confirmServerCreation: (tempId: string, realServer: UserMCPServer) => void;
  confirmServerUpdate: (id: string, updatedServer: UserMCPServer) => void;
  confirmServerDeletion: (id: string) => void;

  // Rollback operations (called on API error)
  rollbackServerCreation: (tempId: string) => void;
  rollbackServerUpdate: (id: string, originalServer: UserMCPServer) => void;
  rollbackServerDeletion: (id: string, originalServer: UserMCPServer) => void;

  // Reset store
  reset: () => void;
}

const generateTempId = () => `temp-${Date.now()}-${Math.random()}`;

export const useMCPServerStore = create<MCPServerState>()(
  devtools(
    (set) => ({
      // Initial state
      servers: [],
      isLoading: false,
      error: null,
      optimisticUpdates: new Set(),
      testingServers: new Set(),

      // Basic state setters
      setServers: (servers) => set({ servers }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Optimistic operations
      addServerOptimistic: (serverData) => {
        const tempId = generateTempId();
        const optimisticServer: UserMCPServer = {
          id: tempId,
          userId: "temp",
          ...serverData,
          isActive: true,
          toolCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          servers: [optimisticServer, ...state.servers],
          optimisticUpdates: new Set([...state.optimisticUpdates, tempId]),
        }));

        return tempId;
      },

      updateServerOptimistic: (data) => {
        set((state) => ({
          servers: state.servers.map((server) =>
            server.id === data.id
              ? { ...server, ...data, updatedAt: new Date() }
              : server
          ),
          optimisticUpdates: new Set([...state.optimisticUpdates, data.id]),
        }));
      },

      deleteServerOptimistic: (id) => {
        set((state) => ({
          servers: state.servers.filter((server) => server.id !== id),
          optimisticUpdates: new Set([...state.optimisticUpdates, id]),
        }));
      },

      // Testing operations
      setServerTesting: (id) => {
        set((state) => {
          const newTestingServers = new Set(state.testingServers);
          newTestingServers.add(id);

          return {
            servers: state.servers.map((server) =>
              server.id === id
                ? {
                    ...server,
                    lastConnectionStatus: "testing",
                    lastConnectionTest: new Date(),
                    lastError: undefined,
                  }
                : server
            ),
            testingServers: newTestingServers,
          };
        });
      },

      updateServerTestResult: (id, result) => {
        set((state) => {
          const newTestingServers = new Set(state.testingServers);
          newTestingServers.delete(id);

          return {
            servers: state.servers.map((server) =>
              server.id === id ? { ...server, ...result } : server
            ),
            testingServers: newTestingServers,
          };
        });
      },

      // Confirm operations
      confirmServerCreation: (tempId, realServer) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(tempId);

          return {
            servers: state.servers.map((server) =>
              server.id === tempId ? realServer : server
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      confirmServerUpdate: (id, updatedServer) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            servers: state.servers.map((server) =>
              server.id === id ? updatedServer : server
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      confirmServerDeletion: (id) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      // Rollback operations
      rollbackServerCreation: (tempId) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(tempId);

          return {
            servers: state.servers.filter((server) => server.id !== tempId),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      rollbackServerUpdate: (id, originalServer) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            servers: state.servers.map((server) =>
              server.id === id ? originalServer : server
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      rollbackServerDeletion: (id, originalServer) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            servers: [...state.servers, originalServer],
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      // Reset store
      reset: () =>
        set({
          servers: [],
          isLoading: false,
          error: null,
          optimisticUpdates: new Set(),
          testingServers: new Set(),
        }),
    }),
    {
      name: "mcp-server-store",
    }
  )
);

// Selectors for computed values
export const useMCPServerSelectors = () => {
  const servers = useMCPServerStore((state) => state.servers);
  const testingServers = useMCPServerStore((state) => state.testingServers);

  return {
    activeServers: servers.filter((server) => server.isActive),
    inactiveServers: servers.filter((server) => !server.isActive),
    totalCount: servers.length,
    activeCount: servers.filter((server) => server.isActive).length,
    connectedServers: servers.filter(
      (server) => server.lastConnectionStatus === "connected"
    ),
    testingServers: Array.from(testingServers),
    isAnyServerTesting: testingServers.size > 0,
  };
};
