"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserA2AServer } from "@/hooks/use-a2a-servers";

type A2AServerState = {
  servers: UserA2AServer[];
  updatedAt: number;
};

type A2AServerActions = {
  setServers: (servers: UserA2AServer[]) => void;
  upsert: (server: UserA2AServer) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useA2AServerStore = create<A2AServerState & A2AServerActions>()(
  persist(
    (set, get) => ({
      servers: [],
      updatedAt: 0,
      setServers: (servers) => set({ servers, updatedAt: Date.now() }),
      upsert: (server) => {
        const list = get().servers;
        const next = list.some((s) => s.id === server.id)
          ? list.map((s) => (s.id === server.id ? server : s))
          : [server, ...list];
        set({ servers: next, updatedAt: Date.now() });
      },
      remove: (id) => {
        set({
          servers: get().servers.filter((s) => s.id !== id),
          updatedAt: Date.now(),
        });
      },
      clear: () => set({ servers: [], updatedAt: 0 }),
    }),
    {
      name: "a2a-servers-cache",
      version: 1,
      partialize: (state) => ({
        servers: state.servers,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
