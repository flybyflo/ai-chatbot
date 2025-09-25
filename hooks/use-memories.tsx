"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: memories, error: swrError } = useSWR<UserMemory[]>(
    "/api/memories",
    fetcher
  );

  const createMemory = async (data: CreateMemoryData) => {
    setIsLoading(true);
    setError(null);

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

      // Optimistically update the cache
      mutate("/api/memories", (currentMemories: UserMemory[] = []) =>
        [newMemory, ...currentMemories], false);

      return newMemory;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create memory";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMemory = async (data: UpdateMemoryData) => {
    setIsLoading(true);
    setError(null);

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

      // Optimistically update the cache
      mutate("/api/memories", (currentMemories: UserMemory[] = []) =>
        currentMemories.map(memory =>
          memory.id === data.id ? updatedMemory : memory
        ), false);

      return updatedMemory;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update memory";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMemory = async (id: string) => {
    setIsLoading(true);
    setError(null);

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

      // Optimistically update the cache
      mutate("/api/memories", (currentMemories: UserMemory[] = []) =>
        currentMemories.filter(memory => memory.id !== id), false);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete memory";
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    memories: memories || [],
    isLoading: isLoading || !memories,
    error: error || swrError?.message,
    createMemory,
    updateMemory,
    deleteMemory,
  };
}