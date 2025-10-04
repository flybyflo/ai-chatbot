"use client";

import {
  Arrow,
  Content,
  Trigger as HoverTrigger,
  Portal,
  Root,
} from "@radix-ui/react-hover-card";
import { Trigger } from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { triggerClass } from "../lib/styles";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

type ToolType = "mcp" | "a2a" | "local";
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
  const mainPanelClass =
    "z-[1000] w-[360px] rounded-lg border border-border/30 bg-popover p-0 text-popover-foreground shadow-md backdrop-blur";
  const sectionHeaderClass =
    "sticky top-0 z-10 flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-popover/95";

  // group tools by server/agent
  const { mcpServers, a2aServers } = useMemo(() => {
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
    return {
      mcpServers: byKey(
        availableTools.filter((t) => t.type === "mcp"),
        "serverName",
        "mcp"
      ),
      a2aServers: byKey(
        availableTools.filter((t) => t.type === "a2a"),
        "agentName",
        "a2a"
      ),
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
      <Trigger className={triggerClass} type="button">
        <span className="font-medium text-xs">Tools</span>
        <ChevronDown size={14} />
      </Trigger>

      {/* MAIN DROPDOWN — minimal spacing */}
      <PromptInputModelSelectContent className={mainPanelClass}>
        {/* Search — edge-to-edge, no outer padding */}
        <div className="border-border/20 border-b">
          <input
            autoComplete="off"
            className="block w-full bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
            onChange={(e) => setSearchTerm(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search servers or tools…"
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto">
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
          <div className="my-1 h-px w-full bg-border/30" />

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
    <div className={className}>
      <Layers size={12} />
      {label}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-2 py-2 text-center text-muted-foreground text-xs">
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
          className="group flex w-full items-center justify-between px-2 py-1.5 text-left transition-colors hover:bg-foreground/10"
          type="button"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`rounded px-1 py-0.5 text-[10px] ${badgeClass}`}>
              {badge}
            </span>
            <span className="truncate font-medium text-xs">{server.label}</span>
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">
              {selectedCount}/{total}
            </span>
            <ChevronRight
              className="opacity-60 group-hover:opacity-100"
              size={12}
            />
          </div>
        </button>
      </HoverTrigger>

      <Portal>
        {/* HOVER PANEL with its own edge-to-edge search */}
        <Content
          align="start"
          className="data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 z-[1000] w-[360px] rounded-lg border border-border/40 bg-popover p-0 text-popover-foreground shadow-xl backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in"
          side="right"
          sideOffset={8}
        >
          {/* Header + bulk actions */}
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${badgeClass}`}
              >
                {badge}
              </span>
              <span className="font-semibold text-xs">{server.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded border border-border/40 px-2 py-0.5 text-[10px] transition-colors hover:bg-foreground/10"
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
                className="rounded border border-border/40 px-2 py-0.5 text-[10px] transition-colors hover:bg-foreground/10"
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
          <div className="max-h-[280px] space-y-1 overflow-y-auto p-1.5">
            {server.tools.map((tool) => {
              const checked = isToolSelected(tool.id);
              return (
                <button
                  className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-foreground/10"
                  key={tool.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTool(tool.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  type="button"
                >
                  <span
                    className={[
                      "mt-0.5 grid size-4 place-items-center rounded border border-border",
                      checked
                        ? "bg-foreground/80 text-background"
                        : "bg-background",
                    ].join(" ")}
                  >
                    {checked && <Check size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-xs">
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

          <Arrow className="fill-popover" />
        </Content>
      </Portal>
    </Root>
  );
}

export const ToolsSelector = memo(PureToolsSelector);
