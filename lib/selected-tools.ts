"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { TOOL_TYPES, type ToolType } from "@/lib/enums";
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

function categorizeTools(
  tools: readonly string[],
  resolveToolType?: (toolId: string) => ToolType | undefined
) {
  const normalized = normalizeTools(tools);
  const categories = {
    mcp: [] as string[],
    a2a: [] as string[],
    local: [] as string[],
  };

  for (const tool of normalized) {
    const type = resolveToolType?.(tool) ?? TOOL_TYPES.MCP;
    if (type === TOOL_TYPES.A2A) {
      categories.a2a.push(tool);
    } else if (type === TOOL_TYPES.LOCAL) {
      categories.local.push(tool);
    } else {
      categories.mcp.push(tool);
    }
  }

  return categories;
}

type SelectionMeta = {
  selectedMcpTools: string[];
  selectedA2AServers: string[];
  selectedLocalTools: string[];
  selectedChatModel?: string;
  selectedReasoningEffort?: "low" | "medium" | "high";
  activeLoadoutId: string | null;
};

type PreferencesUpdate = Partial<{
  selectedTools: string[];
  selectedMcpTools: string[];
  selectedA2AServers: string[];
  selectedLocalTools: string[];
  selectedChatModel: string | null;
  selectedReasoningEffort: "low" | "medium" | "high";
  activeLoadoutId: string | null;
}>;

type UseSharedSelectedToolsOptions = {
  defaultTools?: string[];
  resolveToolType?: (toolId: string) => ToolType | undefined;
};

type SetSelectedToolsFn = (tools: string[]) => string[];
type ToggleToolFn = (toolId: string) => string[];
type UpdatePreferencesFn = (update: PreferencesUpdate) => Promise<void>;

type UseSharedSelectedToolsResult = {
  selectedTools: string[];
  selectedMcpTools: string[];
  selectedA2AServers: string[];
  selectedLocalTools: string[];
  selectedChatModel?: string;
  selectedReasoningEffort?: "low" | "medium" | "high";
  activeLoadoutId: string | null;
  setSelectedTools: SetSelectedToolsFn;
  toggleTool: ToggleToolFn;
  updatePreferences: UpdatePreferencesFn;
  hasHydrated: boolean;
  updatedAt?: number;
};

export function useSharedSelectedTools(
  options: UseSharedSelectedToolsOptions = {}
): UseSharedSelectedToolsResult {
  const session = useSession();
  const userId = session.data?.user?.id;
  const resolveToolType = options.resolveToolType;

  const defaultTools = useMemo(
    () => parseSelectedTools(options.defaultTools ?? []),
    [options.defaultTools]
  );

  const defaultCategories = useMemo(
    () => categorizeTools(defaultTools, resolveToolType),
    [defaultTools, resolveToolType]
  );

  const defaultMeta = useMemo<SelectionMeta>(
    () => ({
      selectedMcpTools: defaultCategories.mcp,
      selectedA2AServers: defaultCategories.a2a,
      selectedLocalTools: defaultCategories.local,
      selectedChatModel: undefined,
      selectedReasoningEffort: undefined,
      activeLoadoutId: null,
    }),
    [defaultCategories]
  );

  const selection = useQuery(
    (api.queries as any).getUserSelectedTools,
    userId ? {} : "skip"
  );

  const persistPreferences = useMutation(
    (api.mutations as any).setUserSelectedTools
  );

  const [selectedTools, setSelectedToolsState] = useState<string[]>(
    defaultTools
  );
  const [selectionMeta, setSelectionMeta] = useState<SelectionMeta>(defaultMeta);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [syncedDefault, setSyncedDefault] = useState(false);

  const isLoadingSelection = Boolean(userId) && selection === undefined;

  const updatePreferences = useCallback<UpdatePreferencesFn>(
    async (update) => {
      const nextTools =
        update.selectedTools !== undefined
          ? parseSelectedTools(update.selectedTools)
          : selectedTools;

      const baseCategories =
        update.selectedTools !== undefined
          ? categorizeTools(nextTools, resolveToolType)
          : {
              mcp: selectionMeta.selectedMcpTools,
              a2a: selectionMeta.selectedA2AServers,
              local: selectionMeta.selectedLocalTools,
            };

      const nextMeta: SelectionMeta = {
        selectedMcpTools:
          update.selectedMcpTools !== undefined
            ? parseSelectedTools(update.selectedMcpTools)
            : baseCategories.mcp,
        selectedA2AServers:
          update.selectedA2AServers !== undefined
            ? parseSelectedTools(update.selectedA2AServers)
            : baseCategories.a2a,
        selectedLocalTools:
          update.selectedLocalTools !== undefined
            ? parseSelectedTools(update.selectedLocalTools)
            : baseCategories.local,
        selectedChatModel:
          update.selectedChatModel !== undefined
            ? update.selectedChatModel ?? undefined
            : selectionMeta.selectedChatModel,
        selectedReasoningEffort:
          update.selectedReasoningEffort !== undefined
            ? update.selectedReasoningEffort
            : selectionMeta.selectedReasoningEffort,
        activeLoadoutId:
          update.activeLoadoutId !== undefined
            ? update.activeLoadoutId ?? null
            : selectionMeta.activeLoadoutId,
      };

      const shouldPersist = Boolean(
        userId &&
          (update.selectedTools !== undefined ||
            update.selectedMcpTools !== undefined ||
            update.selectedA2AServers !== undefined ||
            update.selectedLocalTools !== undefined ||
            update.selectedChatModel !== undefined ||
            update.selectedReasoningEffort !== undefined ||
            update.activeLoadoutId !== undefined)
      );

      setSelectedToolsState(nextTools);
      setSelectionMeta(nextMeta);
      const timestamp = Date.now();
      setUpdatedAt(timestamp);

      if (!shouldPersist) {
        return;
      }

      const payload: Record<string, unknown> = {
        selectedTools: nextTools,
        selectedMcpTools: nextMeta.selectedMcpTools,
        selectedA2AServers: nextMeta.selectedA2AServers,
        selectedLocalTools: nextMeta.selectedLocalTools,
        activeLoadoutId: nextMeta.activeLoadoutId,
      };

      if (nextMeta.selectedChatModel !== undefined) {
        payload.selectedChatModel = nextMeta.selectedChatModel;
      }
      if (nextMeta.selectedReasoningEffort !== undefined) {
        payload.selectedReasoningEffort = nextMeta.selectedReasoningEffort;
      }

      try {
        const result = await persistPreferences(payload);
        setSelectedToolsState(parseSelectedTools(result.selectedTools ?? []));
        setSelectionMeta({
          selectedMcpTools: parseSelectedTools(
            result.selectedMcpTools ?? []
          ),
          selectedA2AServers: parseSelectedTools(
            result.selectedA2AServers ?? []
          ),
          selectedLocalTools: parseSelectedTools(
            result.selectedLocalTools ?? []
          ),
          selectedChatModel: result.selectedChatModel ?? undefined,
          selectedReasoningEffort:
            result.selectedReasoningEffort ?? undefined,
          activeLoadoutId:
            result.activeLoadoutId === undefined
              ? nextMeta.activeLoadoutId
              : result.activeLoadoutId ?? null,
        });
        setUpdatedAt(result.updatedAt);
      } catch (error) {
        console.error("[MCP] Failed to persist user preferences", error);
      }
    },
    [
      persistPreferences,
      resolveToolType,
      selectedTools,
      selectionMeta,
      userId,
    ]
  );

  useEffect(() => {
    if (!userId) {
      if (!arraysEqual(selectedTools, defaultTools)) {
        setSelectedToolsState(defaultTools);
      }
      setSelectionMeta(defaultMeta);
      setUpdatedAt(null);
      setSyncedDefault(false);
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

      const categories = categorizeTools(normalized, resolveToolType);
      setSelectionMeta({
        selectedMcpTools:
          selection.selectedMcpTools &&
          selection.selectedMcpTools.length > 0
            ? parseSelectedTools(selection.selectedMcpTools)
            : categories.mcp,
        selectedA2AServers:
          selection.selectedA2AServers &&
          selection.selectedA2AServers.length > 0
            ? parseSelectedTools(selection.selectedA2AServers)
            : categories.a2a,
        selectedLocalTools:
          selection.selectedLocalTools &&
          selection.selectedLocalTools.length > 0
            ? parseSelectedTools(selection.selectedLocalTools)
            : categories.local,
        selectedChatModel: selection.selectedChatModel ?? undefined,
        selectedReasoningEffort:
          selection.selectedReasoningEffort ?? undefined,
        activeLoadoutId:
          selection.activeLoadoutId === undefined
            ? null
            : selection.activeLoadoutId ?? null,
      });
      setUpdatedAt(selection.updatedAt);
      setSyncedDefault(true);
      return;
    }

    if (!syncedDefault) {
      setSyncedDefault(true);
      if (!arraysEqual(selectedTools, defaultTools)) {
        setSelectedToolsState(defaultTools);
      }
      setSelectionMeta(defaultMeta);
      if (
        defaultTools.length > 0 ||
        defaultMeta.selectedMcpTools.length > 0 ||
        defaultMeta.selectedA2AServers.length > 0 ||
        defaultMeta.selectedLocalTools.length > 0
      ) {
        updatePreferences({
          selectedTools: defaultTools,
          selectedMcpTools: defaultMeta.selectedMcpTools,
          selectedA2AServers: defaultMeta.selectedA2AServers,
          selectedLocalTools: defaultMeta.selectedLocalTools,
          activeLoadoutId: defaultMeta.activeLoadoutId,
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
    defaultMeta,
    defaultTools,
    resolveToolType,
    selection,
    selectedTools,
    syncedDefault,
    updatePreferences,
    userId,
  ]);

  const setSelectedTools: SetSelectedToolsFn = useCallback(
    (tools) => {
      const normalized = parseSelectedTools(tools);
      if (arraysEqual(selectedTools, normalized)) {
        return selectedTools;
      }

      const categories = categorizeTools(normalized, resolveToolType);
      void updatePreferences({
        selectedTools: normalized,
        selectedMcpTools: categories.mcp,
        selectedA2AServers: categories.a2a,
        selectedLocalTools: categories.local,
      });
      return normalized;
    },
    [resolveToolType, selectedTools, updatePreferences]
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
    selectedMcpTools: selectionMeta.selectedMcpTools,
    selectedA2AServers: selectionMeta.selectedA2AServers,
    selectedLocalTools: selectionMeta.selectedLocalTools,
    selectedChatModel: selectionMeta.selectedChatModel,
    selectedReasoningEffort: selectionMeta.selectedReasoningEffort,
    activeLoadoutId: selectionMeta.activeLoadoutId,
    setSelectedTools,
    toggleTool,
    updatePreferences,
    hasHydrated,
    updatedAt: updatedAt ?? undefined,
  };
}
