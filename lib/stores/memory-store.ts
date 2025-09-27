import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UserMemory } from "@/hooks/use-memories";

type UpdateMemoryData = {
  id: string;
  title?: string;
  content?: string;
  isActive?: boolean;
};

interface MemoryState {
  // State
  memories: UserMemory[];
  isLoading: boolean;
  error: string | null;
  optimisticUpdates: Set<string>;

  // Actions
  setMemories: (memories: UserMemory[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // CRUD operations with optimistic updates
  addMemoryOptimistic: (
    memory: Omit<UserMemory, "id" | "userId" | "createdAt" | "updatedAt">
  ) => string;
  updateMemoryOptimistic: (data: UpdateMemoryData) => void;
  deleteMemoryOptimistic: (id: string) => void;

  // Confirm operations (called after successful API response)
  confirmMemoryCreation: (tempId: string, realMemory: UserMemory) => void;
  confirmMemoryUpdate: (id: string, updatedMemory: UserMemory) => void;
  confirmMemoryDeletion: (id: string) => void;

  // Rollback operations (called on API error)
  rollbackMemoryCreation: (tempId: string) => void;
  rollbackMemoryUpdate: (id: string, originalMemory: UserMemory) => void;
  rollbackMemoryDeletion: (id: string, originalMemory: UserMemory) => void;

  // Reset store
  reset: () => void;
}

const generateTempId = () => `temp-${Date.now()}-${Math.random()}`;

export const useMemoryStore = create<MemoryState>()(
  devtools(
    (set) => ({
      // Initial state
      memories: [],
      isLoading: false,
      error: null,
      optimisticUpdates: new Set(),

      // Basic state setters
      setMemories: (memories) => set({ memories }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Optimistic operations
      addMemoryOptimistic: (memoryData) => {
        const tempId = generateTempId();
        const optimisticMemory: UserMemory = {
          id: tempId,
          userId: "temp",
          ...memoryData,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          memories: [optimisticMemory, ...state.memories],
          optimisticUpdates: new Set([...state.optimisticUpdates, tempId]),
        }));

        return tempId;
      },

      updateMemoryOptimistic: (data) => {
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === data.id
              ? { ...memory, ...data, updatedAt: new Date() }
              : memory
          ),
          optimisticUpdates: new Set([...state.optimisticUpdates, data.id]),
        }));
      },

      deleteMemoryOptimistic: (id) => {
        set((state) => ({
          memories: state.memories.filter((memory) => memory.id !== id),
          optimisticUpdates: new Set([...state.optimisticUpdates, id]),
        }));
      },

      // Confirm operations
      confirmMemoryCreation: (tempId, realMemory) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(tempId);

          return {
            memories: state.memories.map((memory) =>
              memory.id === tempId ? realMemory : memory
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      confirmMemoryUpdate: (id, updatedMemory) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            memories: state.memories.map((memory) =>
              memory.id === id ? updatedMemory : memory
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      confirmMemoryDeletion: (id) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      // Rollback operations
      rollbackMemoryCreation: (tempId) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(tempId);

          return {
            memories: state.memories.filter((memory) => memory.id !== tempId),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      rollbackMemoryUpdate: (id, originalMemory) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            memories: state.memories.map((memory) =>
              memory.id === id ? originalMemory : memory
            ),
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      rollbackMemoryDeletion: (id, originalMemory) => {
        set((state) => {
          const newOptimisticUpdates = new Set(state.optimisticUpdates);
          newOptimisticUpdates.delete(id);

          return {
            memories: [...state.memories, originalMemory],
            optimisticUpdates: newOptimisticUpdates,
          };
        });
      },

      // Reset store
      reset: () =>
        set({
          memories: [],
          isLoading: false,
          error: null,
          optimisticUpdates: new Set(),
        }),
    }),
    {
      name: "memory-store",
    }
  )
);

// Selectors for computed values
export const useMemorySelectors = () => {
  const memories = useMemoryStore((state) => state.memories);

  return {
    activeMemories: memories.filter((memory) => memory.isActive),
    inactiveMemories: memories.filter((memory) => !memory.isActive),
    totalCount: memories.length,
    activeCount: memories.filter((memory) => memory.isActive).length,
  };
};
