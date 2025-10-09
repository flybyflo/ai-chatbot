"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";

export type UserMemory = {
  id: string;
  userId: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  const session = useSession();
  const userId = session.data?.user?.id;

  const memoriesQuery = useQuery(
    api.queries.getUserMemories,
    userId ? { userId } : "skip"
  );

  const createMemoryMutation = useMutation(api.mutations.createUserMemory);
  const updateMemoryMutation = useMutation(api.mutations.updateUserMemory);
  const deleteMemoryMutation = useMutation(api.mutations.deleteUserMemory);

  const memories: UserMemory[] = useMemo(() => {
    if (!memoriesQuery) {
      return [];
    }

    return memoriesQuery.map((memory) => ({
      id: memory._id,
      userId: memory.userId,
      title: memory.title,
      content: memory.content,
      isActive: memory.isActive,
      createdAt: new Date(memory.createdAt).toISOString(),
      updatedAt: new Date(memory.updatedAt).toISOString(),
    }));
  }, [memoriesQuery]);

  const createMemory = async (data: CreateMemoryData) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await createMemoryMutation({
      userId,
      title: data.title,
      content: data.content,
    });
  };

  const updateMemory = async (data: UpdateMemoryData) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await updateMemoryMutation({
      id: data.id as Id<"userMemory">,
      userId,
      title: data.title,
      content: data.content,
      isActive: data.isActive,
    });
  };

  const deleteMemory = async (id: string) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await deleteMemoryMutation({
      id: id as Id<"userMemory">,
      userId,
    });
  };

  return {
    memories,
    isLoading: memoriesQuery === undefined,
    createMemory,
    updateMemory,
    deleteMemory,
  };
}
