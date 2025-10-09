"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

type LoadoutState = {
  loadouts: UserLoadout[];
  activeLoadoutId: string | null;
  updatedAt: number;
};

type LoadoutActions = {
  setLoadouts: (loadouts: UserLoadout[]) => void;
  setActiveLoadout: (id: string | null) => void;
  upsert: (loadout: UserLoadout) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useLoadoutStore = create<LoadoutState & LoadoutActions>()(
  persist(
    (set, get) => ({
      loadouts: [],
      activeLoadoutId: null,
      updatedAt: 0,
      setLoadouts: (loadouts) => set({ loadouts, updatedAt: Date.now() }),
      setActiveLoadout: (id) => set({ activeLoadoutId: id }),
      upsert: (loadout) => {
        const list = get().loadouts;
        const next = list.some((l) => l.id === loadout.id)
          ? list.map((l) => (l.id === loadout.id ? loadout : l))
          : [loadout, ...list];
        set({ loadouts: next, updatedAt: Date.now() });
      },
      remove: (id) => {
        set({
          loadouts: get().loadouts.filter((l) => l.id !== id),
          updatedAt: Date.now(),
        });
      },
      clear: () =>
        set({
          loadouts: [],
          activeLoadoutId: null,
          updatedAt: 0,
        }),
    }),
    {
      name: "loadouts-cache",
      version: 1,
      partialize: (state) => ({
        loadouts: state.loadouts,
        activeLoadoutId: state.activeLoadoutId,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
