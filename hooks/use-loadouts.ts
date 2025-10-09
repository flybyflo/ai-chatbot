"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";

export type UserLoadout = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  tags: string[];
  isDefault: boolean;
  selectedTools: string[];
  createdAt: string;
  updatedAt: string;
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

const serializeLoadout = (loadout: any): UserLoadout => ({
  id: loadout._id,
  userId: loadout.userId,
  name: loadout.name,
  description: loadout.description ?? null,
  color: loadout.color ?? null,
  tags: loadout.tags ?? [],
  isDefault: loadout.isDefault,
  selectedTools: loadout.selectedTools ?? [],
  createdAt: new Date(loadout.createdAt).toISOString(),
  updatedAt: new Date(loadout.updatedAt).toISOString(),
});

export function useLoadouts() {
  const session = useSession();
  const userId = session.data?.user?.id;

  const loadoutsQuery = useQuery(
    api.queries.getUserLoadouts,
    userId ? { userId } : "skip"
  );

  const createMutation = useMutation(api.mutations.createUserLoadout);
  const updateMutation = useMutation(api.mutations.updateUserLoadout);
  const deleteMutation = useMutation(api.mutations.deleteUserLoadout);

  const loadouts = useMemo(() => {
    if (!loadoutsQuery) {
      return [] as UserLoadout[];
    }

    return loadoutsQuery.map(serializeLoadout);
  }, [loadoutsQuery]);

  const createLoadout = async (data: CreateLoadoutData) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await createMutation({
      userId,
      name: data.name,
      description: data.description,
      color: data.color,
      tags: data.tags,
      isDefault: data.isDefault,
      selectedTools: data.selectedTools,
    });
  };

  const updateLoadout = async (data: UpdateLoadoutData) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await updateMutation({
      id: data.id as Id<"userLoadouts">,
      userId,
      name: data.name,
      description: data.description,
      color: data.color,
      tags: data.tags,
      isDefault: data.isDefault,
      selectedTools: data.selectedTools,
    });
  };

  const deleteLoadout = async (id: string) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await deleteMutation({
      id: id as Id<"userLoadouts">,
      userId,
    });
  };

  return {
    loadouts,
    isLoading: loadoutsQuery === undefined,
    createLoadout,
    updateLoadout,
    deleteLoadout,
  };
}
