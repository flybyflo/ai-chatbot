"use client";

import {
  Arrow,
  Content,
  Trigger as HoverTrigger,
  Portal,
  Root,
} from "@radix-ui/react-hover-card";
import { Trigger } from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronRight, Plus, Wrench } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { TOOL_TYPES, type ToolType } from "@/lib/enums";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";
import { cn } from "@/lib/utils";

type ToolItem = {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  serverName?: string;
  agentName?: string;
};
type ServerBucket = {
  id: string;
  label: string;
  kind: "mcp" | "a2a";
  tools: ToolItem[];
};

function PureToolsSelector({
  selectedTools = [],
  onToolsChange,
  mcpRegistry: _mcpRegistry,
  a2aRegistry: _a2aRegistry,
  availableTools = [],
}: {
  selectedTools?: string[];
  onToolsChange?: (tools: string[]) => void;
  mcpRegistry?: any;
  a2aRegistry?: any;
  availableTools?: ToolItem[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  // --- minimal main dropdown styles (modern + compact) ---
  const mainPanelClass = cn(
    "z-[1000] w-[360px] overflow-hidden rounded-xl border border-border/60 bg-white/95 p-0 text-foreground shadow-xl",
    "backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/90"
  );
  const sectionHeaderClass = cn(
    "sticky top-0 z-10 flex items-center gap-1.5 border-b border-transparent bg-white/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
    "dark:bg-zinc-950/80"
  );

  // group tools by server/agent
  const { mcpServers, a2aServers, localBucket } = useMemo(() => {
    const byKey = (
      items: ToolItem[],
      key: "serverName" | "agentName",
      kind: "mcp" | "a2a"
    ): ServerBucket[] => {
      const map = new Map<string, ServerBucket>();
      for (const t of items) {
        const id = (t as any)[key] as string | undefined;
        if (!id) {
          continue;
        }
        if (!map.has(id)) {
          map.set(id, { id, label: id, kind, tools: [] });
        }
        const bucket = map.get(id);
        if (bucket) {
          bucket.tools.push(t);
        }
      }
      return Array.from(map.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
    };

    const localTools = availableTools.filter(
      (t) => t.type === TOOL_TYPES.LOCAL
    );
    const localToolsBucket: ServerBucket = {
      id: "local",
      label: "Local Tools",
      kind: "mcp", // reuse "mcp" kind for styling purposes
      tools: localTools,
    };

    return {
      mcpServers: byKey(
        availableTools.filter((t) => t.type === TOOL_TYPES.MCP),
        "serverName",
        "mcp"
      ),
      a2aServers: byKey(
        availableTools.filter((t) => t.type === TOOL_TYPES.A2A),
        "agentName",
        "a2a"
      ),
      localBucket: localToolsBucket,
    };
  }, [availableTools]);

  // filtering (main)
  const filterServers = (servers: ServerBucket[]) => {
    if (!searchTerm) {
      return servers;
    }
    const q = searchTerm.toLowerCase();
    return servers.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.tools.some(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        )
    );
  };
  const filteredMCP = filterServers(mcpServers);
  const filteredA2A = filterServers(a2aServers);
  const filteredLocal = filterServers([localBucket])[0] ? [localBucket] : [];

  // selection
  const isToolSelected = (id: string) => selectedTools.includes(id);
  const toggleTool = (toolId: string) => {
    if (!onToolsChange) {
      return;
    }
    onToolsChange(
      isToolSelected(toolId)
        ? selectedTools.filter((id) => id !== toolId)
        : [...selectedTools, toolId]
    );
  };
  const selectAllInServer = (server: ServerBucket) => {
    if (!onToolsChange) {
      return;
    }
    const merged = new Set(selectedTools);
    for (const t of server.tools) {
      merged.add(t.id);
    }
    onToolsChange(Array.from(merged));
  };
  const clearAllInServer = (server: ServerBucket) => {
    if (!onToolsChange) {
      return;
    }
    const toRemove = new Set(server.tools.map((t) => t.id));
    onToolsChange(selectedTools.filter((id) => !toRemove.has(id)));
  };
  const selectedCountForServer = (s: ServerBucket) =>
    s.tools.reduce((n, t) => n + (isToolSelected(t.id) ? 1 : 0), 0);

  return (
    <PromptInputModelSelect
      onValueChange={() => {
        // No-op for tools selector
      }}
    >
      <Trigger
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
        type="button"
      >
        <Wrench size={16} />
        <span className="font-medium text-xs">Tools</span>
        <ChevronDown size={14} />
      </Trigger>

      {/* MAIN DROPDOWN — minimal spacing */}
      <PromptInputModelSelectContent className={mainPanelClass}>
        {/* Search — edge-to-edge, no outer padding */}
        <div className="border-border/40 border-b bg-white/70 px-3 py-2 dark:bg-zinc-950/60">
          <input
            autoComplete="off"
            className="block w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-medium text-foreground/90 outline-none placeholder:text-muted-foreground focus:border-border focus:ring-0 dark:text-zinc-100"
            onChange={(e) => setSearchTerm(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search servers or tools…"
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {/* Local Tools */}
          <SectionHeader className={sectionHeaderClass} label="Local Tools" />
          {filteredLocal.length === 0 ? (
            <EmptyRow
              message={
                searchTerm ? "No local tools match" : "No local tools found"
              }
            />
          ) : (
            filteredLocal.map((bucket) => (
              <ServerRow
                badge="LOCAL"
                badgeClass="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                isToolSelected={isToolSelected}
                key="local"
                onClearAll={() => clearAllInServer(bucket)}
                onSelectAll={() => selectAllInServer(bucket)}
                onToggleTool={toggleTool}
                selectedCount={selectedCountForServer(bucket)}
                server={bucket}
              />
            ))
          )}

          {/* Divider */}
          <div className="my-1 h-px w-full bg-border/40" />

          {/* MCP */}
          <SectionHeader className={sectionHeaderClass} label="MCP Servers" />
          {filteredMCP.length === 0 ? (
            <EmptyRow
              message={
                searchTerm ? "No MCP servers match" : "No MCP servers found"
              }
            />
          ) : (
            filteredMCP.map((server) => (
              <ServerRow
                badge="MCP"
                badgeClass="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                isToolSelected={isToolSelected}
                key={`mcp:${server.id}`}
                onClearAll={() => clearAllInServer(server)}
                onSelectAll={() => selectAllInServer(server)}
                onToggleTool={toggleTool}
                selectedCount={selectedCountForServer(server)}
                server={server}
              />
            ))
          )}

          {/* Divider */}
          <div className="my-1 h-px w-full bg-border/40" />

          {/* A2A */}
          <SectionHeader className={sectionHeaderClass} label="A2A Agents" />
          {filteredA2A.length === 0 ? (
            <EmptyRow
              message={
                searchTerm ? "No A2A agents match" : "No A2A agents found"
              }
            />
          ) : (
            filteredA2A.map((server) => (
              <ServerRow
                badge="A2A"
                badgeClass="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                isToolSelected={isToolSelected}
                key={`a2a:${server.id}`}
                onClearAll={() => clearAllInServer(server)}
                onSelectAll={() => selectAllInServer(server)}
                onToggleTool={toggleTool}
                selectedCount={selectedCountForServer(server)}
                server={server}
              />
            ))
          )}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

/* ---------- UI bits ---------- */

function SectionHeader({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[10px]", className)}>
      <Wrench className="text-muted-foreground" size={12} />
      {label}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-3 py-4 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
}

function ServerRow({
  server,
  badge,
  badgeClass,
  onSelectAll,
  onClearAll,
  onToggleTool,
  isToolSelected,
  selectedCount,
}: {
  server: ServerBucket;
  badge: string;
  badgeClass: string;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleTool: (id: string) => void;
  isToolSelected: (id: string) => boolean;
  selectedCount: number;
}) {
  const total = server.tools.length;

  return (
    <Root closeDelay={200} openDelay={80}>
      <HoverTrigger asChild>
        <button
          className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
          type="button"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
              {badge}
            </span>
            <span className="truncate font-medium text-xs">{server.label}</span>
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {selectedCount}/{total}
            </span>
            <ChevronRight
              className="text-muted-foreground opacity-60 group-hover:opacity-100"
              size={12}
            />
          </div>
        </button>
      </HoverTrigger>

      <Portal>
        {/* HOVER PANEL with its own edge-to-edge search */}
        <Content
          align="start"
          className={cn(
            "z-[1000] w-[360px] overflow-hidden rounded-xl border border-border/60 bg-white/95 text-foreground shadow-2xl",
            "backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-zinc-800 dark:bg-zinc-950/90",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
          side="right"
          sideOffset={8}
        >
          {/* Header + bulk actions */}
          <div className="flex items-center justify-between border-border/40 border-b bg-white/80 px-3 py-2 dark:bg-zinc-950/70">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
              >
                {badge}
              </span>
              <span className="font-semibold text-xs text-foreground">
                {server.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                type="button"
              >
                Select all
              </button>
              <button
                className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="max-h-[280px] space-y-1 overflow-y-auto bg-white/60 p-2 dark:bg-transparent">
            {server.tools.map((tool) => {
              const checked = isToolSelected(tool.id);
              return (
                <button
                  className="flex w-full items-start gap-3 rounded-lg border border-transparent bg-white/60 p-2.5 text-left transition-colors hover:border-border/60 hover:bg-muted dark:bg-zinc-950/60"
                  key={tool.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTool(tool.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 place-items-center rounded border",
                      checked
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-200"
                        : "border-border/60 bg-white text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950"
                    )}
                  >
                    {checked ? <Check size={14} /> : <Plus size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-xs text-foreground">
                        {tool.name}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {tool.id}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <Arrow className="fill-white/95 dark:fill-zinc-950/90" />
        </Content>
      </Portal>
    </Root>
  );
}

export const ToolsSelector = memo(PureToolsSelector);
