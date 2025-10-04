"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/enums";
import { fetcher } from "@/lib/utils";

export type UserLoadout = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  tags?: string[] | null;
  isDefault: boolean;
  selectedTools?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateLoadoutData = {
  name: string;
  description?: string;
  color?: string;
  tags?: string[];
  isDefault?: boolean;
  selectedTools?: string[];
};

type UpdateLoadoutData = {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  tags?: string[];
  isDefault?: boolean;
  selectedTools?: string[];
};

const QUERY_KEY = QUERY_KEYS.LOADOUTS;

export function useLoadouts() {
  const queryClient = useQueryClient();

  // Query for fetching loadouts
  const {
    data: loadouts = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetcher("/api/loadouts")) as UserLoadout[],
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  // Create loadout mutation with optimistic updates
  const createLoadoutMutation = useMutation({
    mutationFn: async (data: CreateLoadoutData): Promise<UserLoadout> => {
      const response = await fetch("/api/loadouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create loadout");
      }

      return response.json();
    },
    onMutate: async (newLoadout) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      // Snapshot the previous value
      const previousLoadouts =
        queryClient.getQueryData<UserLoadout[]>(QUERY_KEY);

      // Optimistically update to the new value
      const optimisticLoadout: UserLoadout = {
        id: `temp-${Date.now()}`,
        userId: "temp",
        name: newLoadout.name,
        description: newLoadout.description,
        color: newLoadout.color,
        tags: newLoadout.tags,
        isDefault: newLoadout.isDefault ?? false,
        selectedTools: newLoadout.selectedTools,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData<UserLoadout[]>(QUERY_KEY, (old = []) => [
        optimisticLoadout,
        ...old,
      ]);

      // Return a context object with the snapshotted value
      return { previousLoadouts, optimisticLoadout };
    },
    onError: (_err, _newLoadout, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousLoadouts) {
        queryClient.setQueryData(QUERY_KEY, context.previousLoadouts);
      }
    },
    onSuccess: (data, _variables, context) => {
      // Update the optimistic loadout with the real data from server
      queryClient.setQueryData<UserLoadout[]>(QUERY_KEY, (old = []) =>
        old.map((loadout) =>
          loadout.id === context?.optimisticLoadout.id ? data : loadout
        )
      );
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update loadout mutation with optimistic updates
  const updateLoadoutMutation = useMutation({
    mutationFn: async (data: UpdateLoadoutData): Promise<UserLoadout> => {
      const response = await fetch("/api/loadouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update loadout");
      }

      return response.json();
    },
    onMutate: async (updatedLoadout) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousLoadouts =
        queryClient.getQueryData<UserLoadout[]>(QUERY_KEY);

      // Optimistically update
      queryClient.setQueryData<UserLoadout[]>(QUERY_KEY, (old = []) =>
        old.map((loadout) =>
          loadout.id === updatedLoadout.id
            ? { ...loadout, ...updatedLoadout, updatedAt: new Date() }
            : loadout
        )
      );

      return { previousLoadouts };
    },
    onError: (_err, _newLoadout, context) => {
      if (context?.previousLoadouts) {
        queryClient.setQueryData(QUERY_KEY, context.previousLoadouts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Delete loadout mutation with optimistic updates
  const deleteLoadoutMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch("/api/loadouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete loadout");
      }
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });

      const previousLoadouts =
        queryClient.getQueryData<UserLoadout[]>(QUERY_KEY);

      // Optimistically remove the loadout
      queryClient.setQueryData<UserLoadout[]>(QUERY_KEY, (old = []) =>
        old.filter((loadout) => loadout.id !== deletedId)
      );

      return { previousLoadouts };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousLoadouts) {
        queryClient.setQueryData(QUERY_KEY, context.previousLoadouts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    loadouts,
    isLoading,
    isFetching,
    error: error?.message || null,
    createLoadout: createLoadoutMutation.mutateAsync,
    updateLoadout: updateLoadoutMutation.mutateAsync,
    deleteLoadout: deleteLoadoutMutation.mutateAsync,
    isCreating: createLoadoutMutation.isPending,
    isUpdating: updateLoadoutMutation.isPending,
    isDeleting: deleteLoadoutMutation.isPending,
  };
}
