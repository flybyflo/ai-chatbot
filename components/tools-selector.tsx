"use client";

import { Trigger } from "@radix-ui/react-select";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { TOOL_TYPES, type ToolType } from "@/lib/enums";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

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
}: Readonly<{
  selectedTools?: string[];
  onToolsChange?: (tools: string[]) => void;
  mcpRegistry?: any;
  a2aRegistry?: any;
  availableTools?: ToolItem[];
}>) {
  // main search (list view)
  const [searchTerm, setSearchTerm] = useState("");

  // detail view state
  const [activeServer, setActiveServer] = useState<ServerBucket | null>(null);
  const [detailSearch, setDetailSearch] = useState("");

  const mainPanelClass =
    "z-[1000] w-[360px] rounded-2xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur";

  const sectionHeaderClass =
    "sticky top-0 z-10 mx-1 mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-(--tool-bg)";

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
        map.get(id)?.tools.push(t);
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
      kind: "mcp",
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
    const newTools = isToolSelected(toolId)
      ? selectedTools.filter((id) => id !== toolId)
      : [...selectedTools, toolId];
    onToolsChange(newTools);
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

  // helpers
  const navigateInto = (server: ServerBucket) => {
    setDetailSearch("");
    setActiveServer(server);
  };
  const navigateBack = () => {
    setActiveServer(null);
  };

  // detail tools (filtered)
  const filteredDetailTools = useMemo(() => {
    if (!activeServer) {
      return [];
    }
    if (!detailSearch) {
      return activeServer.tools;
    }
    const q = detailSearch.toLowerCase();
    return activeServer.tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [activeServer, detailSearch]);

  return (
    // biome-ignore lint/suspicious/noEmptyBlockStatements: this is a dummy onValueChange
    <PromptInputModelSelect onValueChange={() => {}}>
      {/* Trigger stays unchanged */}
      <Trigger
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
        type="button"
      >
        <Wrench size={16} />
        <span className="font-medium text-xs">Tools</span>
        <ChevronDown size={14} />
      </Trigger>

      {/* Single panel with in-panel navigation */}
      <PromptInputModelSelectContent className={mainPanelClass}>
        {/* Constrain height to keep size stable across views */}
        <div className="flex h-[360px] flex-col">
          {activeServer ? (
            /* ---------- DETAIL VIEW ---------- */
            <>
              {/* Header + bulk actions + Back */}
              <div className="mx-1 mt-1 flex items-center justify-between gap-2 rounded-xl border border-border/20 bg-(--tool-bg) px-2 py-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button
                    aria-label="Back"
                    className="rounded-md p-1 hover:bg-foreground/10"
                    onClick={navigateBack}
                    onPointerDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="truncate font-semibold text-xs">
                    {activeServer.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedCountForServer(activeServer)}/
                    {activeServer.tools.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-md border border-border/40 px-2 py-0.5 text-[10px] transition-colors hover:bg-foreground/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInServer(activeServer);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    Select all
                  </button>
                  <button
                    className="rounded-md border border-border/40 px-2 py-0.5 text-[10px] transition-colors hover:bg-foreground/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllInServer(activeServer);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Detail search */}
              <div className="mx-1 mt-1 rounded-xl border border-border/20 bg-(--tool-bg)">
                <input
                  autoComplete="off"
                  className="block w-full rounded-xl bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
                  onChange={(e) => setDetailSearch(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Search tools…"
                  type="text"
                  value={detailSearch}
                />
              </div>

              {/* Tools list */}
              <div className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
                {filteredDetailTools.length === 0 ? (
                  <EmptyRow message="No tools match" />
                ) : (
                  filteredDetailTools.map((tool) => {
                    const checked = isToolSelected(tool.id);
                    return (
                      <button
                        className="flex w-full items-start gap-2 rounded-xl border border-transparent p-2 text-left transition-colors hover:bg-foreground/10"
                        key={tool.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTool(tool.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        type="button"
                      >
                        <span
                          className={[
                            "mt-0.5 grid size-4 place-items-center rounded border border-border bg-background",
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
                  })
                )}
              </div>
            </>
          ) : (
            /* ---------- MAIN LIST VIEW ---------- */
            <>
              {/* Search */}
              <div className="mx-1 mt-1 rounded-xl border border-border/20 bg-(--tool-bg)">
                <input
                  autoComplete="off"
                  className="block w-full rounded-xl bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Search servers or tools…"
                  type="text"
                  value={searchTerm}
                />
              </div>

              {/* Lists */}
              <div className="flex-1 overflow-y-auto">
                {/* Local Tools */}
                <SectionHeader
                  className={sectionHeaderClass}
                  label="Local Tools"
                />
                {filteredLocal.length === 0 ? (
                  <EmptyRow
                    message={
                      searchTerm
                        ? "No local tools match"
                        : "No local tools found"
                    }
                  />
                ) : (
                  filteredLocal.map((bucket) => (
                    <ServerListRow
                      badge="LOCAL"
                      badgeClass="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      key="local"
                      onClick={() => navigateInto(bucket)}
                      selectedCount={selectedCountForServer(bucket)}
                      server={bucket}
                    />
                  ))
                )}

                {/* Divider */}
                <div className="my-1 h-px w-full bg-border/30" />

                {/* MCP */}
                <SectionHeader
                  className={sectionHeaderClass}
                  label="MCP Servers"
                />
                {filteredMCP.length === 0 ? (
                  <EmptyRow
                    message={
                      searchTerm
                        ? "No MCP servers match"
                        : "No MCP servers found"
                    }
                  />
                ) : (
                  filteredMCP.map((server) => (
                    <ServerListRow
                      badge="MCP"
                      badgeClass="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      key={`mcp:${server.id}`}
                      onClick={() => navigateInto(server)}
                      selectedCount={selectedCountForServer(server)}
                      server={server}
                    />
                  ))
                )}

                {/* Divider */}
                <div className="my-1 h-px w-full bg-border/30" />

                {/* A2A */}
                <SectionHeader
                  className={sectionHeaderClass}
                  label="A2A Agents"
                />
                {filteredA2A.length === 0 ? (
                  <EmptyRow
                    message={
                      searchTerm ? "No A2A agents match" : "No A2A agents found"
                    }
                  />
                ) : (
                  filteredA2A.map((server) => (
                    <ServerListRow
                      badge="A2A"
                      badgeClass="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                      key={`a2a:${server.id}`}
                      onClick={() => navigateInto(server)}
                      selectedCount={selectedCountForServer(server)}
                      server={server}
                    />
                  ))
                )}
              </div>
            </>
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
}: Readonly<{
  label: string;
  className?: string;
}>) {
  return (
    <div className={className}>
      <Wrench size={12} />
      {label}
    </div>
  );
}

function EmptyRow({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-2 my-1 rounded-lg bg-(--tool-bg) px-2 py-2 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
}

function ServerListRow({
  server,
  badge,
  badgeClass,
  selectedCount,
  onClick,
}: Readonly<{
  server: ServerBucket;
  badge: string;
  badgeClass: string;
  selectedCount: number;
  onClick: () => void;
}>) {
  const total = server.tools.length;

  return (
    <button
      className="group mx-1 my-1 flex w-[calc(100%-0.5rem)] items-center justify-between rounded-xl border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-foreground/10"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`rounded-md px-1 py-0.5 text-[10px] ${badgeClass}`}>
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
  );
}

export const ToolsSelector = memo(PureToolsSelector);
