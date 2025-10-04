"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/enums";
import { fetcher } from "@/lib/utils";

export type UserMemory = {
  id: string;
  userId: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CreateMemoryData = {
  title: string;
  content: string;
};

type UpdateMemoryData = {
  id: string;
  title?: string;
  content?: string;
  isActive?: boolean;
};

const QUERY_KEY = QUERY_KEYS.MEMORIES;

export function useMemories() {
  const queryClient = useQueryClient();

  // Query for fetching memories
  const {
    data: memories = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetcher("/api/memories")) as UserMemory[],
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  // Create memory mutation with optimistic updates
  const createMemoryMutation = useMutation({
    mutationFn: async (data: CreateMemoryData): Promise<UserMemory> => {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create memory");
      }

      return response.json();
    },
    onMutate: async (newMemory) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      // Snapshot the previous value
      const previousMemories =
        queryClient.getQueryData<UserMemory[]>(QUERY_KEY);

      // Optimistically update to the new value
      const optimisticMemory: UserMemory = {
        id: `temp-${Date.now()}`,
        userId: "temp",
        title: newMemory.title,
        content: newMemory.content,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData<UserMemory[]>(QUERY_KEY, (old = []) => [
        optimisticMemory,
        ...old,
      ]);

      // Return a context object with the snapshotted value
      return { previousMemories, optimisticMemory };
    },
    onError: (_err, _newMemory, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMemories) {
        queryClient.setQueryData(QUERY_KEY, context.previousMemories);
      }
    },
    onSuccess: (data, _variables, context) => {
      // Update the optimistic memory with the real data from server
      queryClient.setQueryData<UserMemory[]>(QUERY_KEY, (old = []) =>
        old.map((memory) =>
          memory.id === context?.optimisticMemory.id ? data : memory
        )
      );
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update memory mutation with optimistic updates
  const updateMemoryMutation = useMutation({
    mutationFn: async (data: UpdateMemoryData): Promise<UserMemory> => {
      const response = await fetch("/api/memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update memory");
      }

      return response.json();
    },
    onMutate: async (updatedMemory) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousMemories =
        queryClient.getQueryData<UserMemory[]>(QUERY_KEY);

      // Optimistically update
      queryClient.setQueryData<UserMemory[]>(QUERY_KEY, (old = []) =>
        old.map((memory) =>
          memory.id === updatedMemory.id
            ? { ...memory, ...updatedMemory, updatedAt: new Date() }
            : memory
        )
      );

      return { previousMemories };
    },
    onError: (_err, _newMemory, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(QUERY_KEY, context.previousMemories);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Delete memory mutation with optimistic updates
  const deleteMemoryMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete memory");
      }
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousMemories =
        queryClient.getQueryData<UserMemory[]>(QUERY_KEY);

      // Optimistically remove the memory
      queryClient.setQueryData<UserMemory[]>(QUERY_KEY, (old = []) =>
        old.filter((memory) => memory.id !== deletedId)
      );

      return { previousMemories };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(QUERY_KEY, context.previousMemories);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    memories,
    isLoading,
    isFetching,
    error: error?.message || null,
    createMemory: createMemoryMutation.mutateAsync,
    updateMemory: updateMemoryMutation.mutateAsync,
    deleteMemory: deleteMemoryMutation.mutateAsync,
    isCreating: createMemoryMutation.isPending,
    isUpdating: updateMemoryMutation.isPending,
    isDeleting: deleteMemoryMutation.isPending,
  };
}
