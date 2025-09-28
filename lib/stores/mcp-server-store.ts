"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserMCPServer } from "@/hooks/use-mcp-servers";

type MCPServerState = {
  servers: UserMCPServer[];
  updatedAt: number;
  selectedTools: string[];
  selectedToolsUpdatedAt: number;
};

type MCPServerActions = {
  setServers: (servers: UserMCPServer[]) => void;
  upsert: (server: UserMCPServer) => void;
  remove: (id: string) => void;
  clear: () => void;
  setSelectedTools: (tools: string[]) => void;
  toggleSelectedTool: (id: string) => void;
};

export const useMCPServerStore = create<MCPServerState & MCPServerActions>()(
  persist(
    (set, get) => ({
      servers: [],
      updatedAt: 0,
      selectedTools: [],
      selectedToolsUpdatedAt: 0,
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
      clear: () =>
        set({
          servers: [],
          updatedAt: 0,
          selectedTools: [],
          selectedToolsUpdatedAt: 0,
        }),
      setSelectedTools: (tools) =>
        set({ selectedTools: tools, selectedToolsUpdatedAt: Date.now() }),
      toggleSelectedTool: (id) => {
        const current = get().selectedTools;
        const next = current.includes(id)
          ? current.filter((t) => t !== id)
          : [id, ...current];
        set({ selectedTools: next, selectedToolsUpdatedAt: Date.now() });
      },
    }),
    {
      name: "mcp-servers-cache",
      version: 1,
      partialize: (state) => ({
        servers: state.servers,
        updatedAt: state.updatedAt,
        selectedTools: state.selectedTools,
        selectedToolsUpdatedAt: state.selectedToolsUpdatedAt,
      }),
    }
  )
);
