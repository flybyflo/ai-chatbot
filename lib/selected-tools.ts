"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { selectedToolsSchema } from "@/lib/schemas/tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";

function normalizeTools(tools: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tool of tools) {
    if (!seen.has(tool)) {
      seen.add(tool);
      normalized.push(tool);
    }
  }

  return normalized;
}

function parseSelectedTools(value: unknown): string[] {
  const parsed = selectedToolsSchema.safeParse(value);
  if (!parsed.success) {
    return [];
  }
  return normalizeTools(parsed.data);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

export function commitSelectedTools(next: string[]): string[] {
  const normalized = parseSelectedTools(next);
  const { selectedTools, setSelectedTools } = useMCPServerStore.getState();

  if (!arraysEqual(selectedTools, normalized)) {
    setSelectedTools(normalized);
  }

  return normalized;
}

export function getSelectedToolsSnapshot(): string[] {
  return parseSelectedTools(useMCPServerStore.getState().selectedTools);
}

type UseSharedSelectedToolsOptions = {
  defaultTools?: string[];
};

export function useSharedSelectedTools(
  options: UseSharedSelectedToolsOptions = {}
) {
  const persistApi = useMCPServerStore.persist;
  const persistEnabled = Boolean(persistApi?.hasHydrated);
  const [selectedTools, selectedToolsUpdatedAt] = useMCPServerStore((state) => [
    state.selectedTools,
    state.selectedToolsUpdatedAt,
  ]);

  const [hasHydrated, setHasHydrated] = useState(
    persistEnabled ? persistApi?.hasHydrated?.() ?? false : true
  );

  useEffect(() => {
    if (!persistEnabled || !persistApi?.onFinishHydration) {
      return;
    }

    const unsub = persistApi.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return () => {
      unsub();
    };
  }, [persistApi, persistEnabled]);

  const defaultTools = useMemo(() => {
    if (!options.defaultTools || options.defaultTools.length === 0) {
      return [] as string[];
    }

    return parseSelectedTools(options.defaultTools);
  }, [options.defaultTools]);

  useEffect(() => {
    if (persistEnabled && !hasHydrated) {
      return;
    }

    if (selectedTools.length === 0 && defaultTools.length > 0) {
      commitSelectedTools(defaultTools);
    }
  }, [defaultTools, hasHydrated, persistEnabled, selectedTools.length]);

  const setSelectedTools = useCallback(
    (tools: string[]): string[] => commitSelectedTools(tools),
    []
  );

  const toggleTool = useCallback(
    (toolId: string): string[] => {
      const base = persistEnabled && !hasHydrated ? defaultTools : selectedTools;

      const next = base.includes(toolId)
        ? base.filter((id) => id !== toolId)
        : [...base, toolId];

      return setSelectedTools(next);
    },
    [defaultTools, hasHydrated, persistEnabled, selectedTools, setSelectedTools]
  );

  const effectiveTools =
    persistEnabled && !hasHydrated ? defaultTools : selectedTools;

  return {
    selectedTools: effectiveTools,
    setSelectedTools,
    toggleTool,
    hasHydrated,
    updatedAt: selectedToolsUpdatedAt,
  };
}
