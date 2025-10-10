"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { selectedToolsSchema } from "@/lib/schemas/tools";

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

type UseSharedSelectedToolsOptions = {
  defaultTools?: string[];
};

type SetSelectedToolsFn = (tools: string[]) => string[];
type ToggleToolFn = (toolId: string) => string[];

type UseSharedSelectedToolsResult = {
  selectedTools: string[];
  setSelectedTools: SetSelectedToolsFn;
  toggleTool: ToggleToolFn;
  hasHydrated: boolean;
  updatedAt?: number;
};

export function useSharedSelectedTools(
  options: UseSharedSelectedToolsOptions = {}
): UseSharedSelectedToolsResult {
  const session = useSession();
  const userId = session.data?.user?.id;

  const defaultTools = useMemo(
    () => parseSelectedTools(options.defaultTools ?? []),
    [options.defaultTools]
  );

  const selection = useQuery(
    (api.queries as any).getUserSelectedTools,
    userId ? { userId } : "skip"
  );

  const persistSelection = useMutation(
    (api.mutations as any).setUserSelectedTools
  );

  const [selectedTools, setSelectedToolsState] = useState<string[]>(
    defaultTools
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [syncedDefault, setSyncedDefault] = useState(false);

  const isLoadingSelection = Boolean(userId) && selection === undefined;

  useEffect(() => {
    if (!userId) {
      if (!arraysEqual(selectedTools, defaultTools)) {
        setSelectedToolsState(defaultTools);
      }
      setUpdatedAt(null);
      return;
    }

    if (selection === undefined) {
      return;
    }

    if (selection) {
      const normalized = parseSelectedTools(selection.selectedTools);
      if (!arraysEqual(selectedTools, normalized)) {
        setSelectedToolsState(normalized);
      }
      setUpdatedAt(selection.updatedAt);
      setSyncedDefault(true);
      return;
    }

    if (!syncedDefault) {
      setSyncedDefault(true);
      if (!arraysEqual(selectedTools, defaultTools)) {
        setSelectedToolsState(defaultTools);
      }
      if (defaultTools.length > 0) {
        persistSelection({
          userId,
          selectedTools: defaultTools,
        }).catch((error) => {
          console.error(
            "[MCP] Failed to persist default tool selection",
            error
          );
          setSyncedDefault(false);
        });
      }
    }
  }, [
    defaultTools,
    persistSelection,
    selection,
    selectedTools,
    syncedDefault,
    userId,
  ]);

  const persistTools = useCallback(
    (tools: string[], timestamp: number) => {
      if (!userId) {
        return;
      }

      persistSelection({
        userId,
        selectedTools: tools,
      })
        .then((result) => {
          if (result && typeof result.updatedAt === "number") {
            setUpdatedAt(result.updatedAt);
          } else {
            setUpdatedAt(timestamp);
          }
        })
        .catch((error) => {
          console.error("[MCP] Failed to persist selected tools", error);
        });
    },
    [persistSelection, userId]
  );

  const setSelectedTools: SetSelectedToolsFn = useCallback(
    (tools) => {
      const normalized = parseSelectedTools(tools);
      if (arraysEqual(selectedTools, normalized)) {
        return selectedTools;
      }

      setSelectedToolsState(normalized);
      const timestamp = Date.now();
      setUpdatedAt(timestamp);
      persistTools(normalized, timestamp);
      return normalized;
    },
    [persistTools, selectedTools]
  );

  const toggleTool: ToggleToolFn = useCallback(
    (toolId) => {
      const base = selectedTools;
      const next = base.includes(toolId)
        ? base.filter((id) => id !== toolId)
        : [toolId, ...base];
      return setSelectedTools(next);
    },
    [selectedTools, setSelectedTools]
  );

  const hasHydrated = !userId || !isLoadingSelection;

  return {
    selectedTools,
    setSelectedTools,
    toggleTool,
    hasHydrated,
    updatedAt: updatedAt ?? undefined,
  };
}
