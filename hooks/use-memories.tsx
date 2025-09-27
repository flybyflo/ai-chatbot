"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useMemoryStore } from "@/lib/stores/memory-store";
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

export function useMemories() {
  const [actionLoading, setActionLoading] = useState(false);

  // Zustand store
  const {
    memories,
    isLoading: storeLoading,
    error: storeError,
    setMemories,
    setLoading,
    setError,
    addMemoryOptimistic,
    updateMemoryOptimistic,
    deleteMemoryOptimistic,
    confirmMemoryCreation,
    confirmMemoryUpdate,
    confirmMemoryDeletion,
    rollbackMemoryCreation,
    rollbackMemoryUpdate,
    rollbackMemoryDeletion,
  } = useMemoryStore();

  // SWR for initial data fetching
  const {
    data: swrMemories,
    error: swrError,
    isLoading: swrLoading,
  } = useSWR<UserMemory[]>("/api/memories", fetcher);

  // Sync SWR data with Zustand store
  useEffect(() => {
    if (swrMemories && !storeLoading) {
      setMemories(swrMemories);
    }
  }, [swrMemories, setMemories, storeLoading]);

  // Set loading state from SWR
  useEffect(() => {
    setLoading(swrLoading && memories.length === 0);
  }, [swrLoading, memories.length, setLoading]);

  // Set error state from SWR
  useEffect(() => {
    setError(swrError?.message || null);
  }, [swrError, setError]);

  const createMemory = async (data: CreateMemoryData) => {
    setActionLoading(true);
    setError(null);

    // Add optimistic update
    const tempId = addMemoryOptimistic({
      title: data.title,
      content: data.content,
      isActive: true,
    });

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create memory");
      }

      const newMemory = await response.json();

      // Confirm optimistic update
      confirmMemoryCreation(tempId, newMemory);

      return newMemory;
    } catch (err) {
      // Rollback optimistic update
      rollbackMemoryCreation(tempId);

      const message =
        err instanceof Error ? err.message : "Failed to create memory";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const updateMemory = async (data: UpdateMemoryData) => {
    setActionLoading(true);
    setError(null);

    // Store original memory for rollback
    const originalMemory = memories.find((m) => m.id === data.id);
    if (!originalMemory) {
      throw new Error("Memory not found");
    }

    // Add optimistic update
    updateMemoryOptimistic(data);

    try {
      const response = await fetch("/api/memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update memory");
      }

      const updatedMemory = await response.json();

      // Confirm optimistic update
      confirmMemoryUpdate(data.id, updatedMemory);

      return updatedMemory;
    } catch (err) {
      // Rollback optimistic update
      rollbackMemoryUpdate(data.id, originalMemory);

      const message =
        err instanceof Error ? err.message : "Failed to update memory";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMemory = async (id: string) => {
    setActionLoading(true);
    setError(null);

    // Store original memory for rollback
    const originalMemory = memories.find((m) => m.id === id);
    if (!originalMemory) {
      throw new Error("Memory not found");
    }

    // Add optimistic update
    deleteMemoryOptimistic(id);

    try {
      const response = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete memory");
      }

      // Confirm optimistic update
      confirmMemoryDeletion(id);

      return true;
    } catch (err) {
      // Rollback optimistic update
      rollbackMemoryDeletion(id, originalMemory);

      const message =
        err instanceof Error ? err.message : "Failed to delete memory";
      setError(message);
      throw new Error(message);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    memories,
    isLoading: storeLoading || actionLoading,
    error: storeError,
    createMemory,
    updateMemory,
    deleteMemory,
  };
}
