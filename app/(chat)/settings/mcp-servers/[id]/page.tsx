"use client";

import {
  CheckCircle,
  Clock,
  ExternalLink,
  TestTube,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMCPServers } from "@/hooks/use-mcp-servers";
import { useAllTools } from "@/hooks/use-tools";
import { TOOL_TYPES } from "@/lib/enums";
import { useSharedSelectedTools } from "@/lib/selected-tools";

type MCPServerSettingsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

/* ----------------------------- Loading state ----------------------------- */

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-10 w-full border-border/30 border-b bg-popover/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="mx-auto grid max-w-5xl gap-4 px-3 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-8 w-full" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
          <Skeleton className="h-4 w-44" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>

      {/* Tools list */}
      <div className="mx-auto max-w-5xl space-y-2 px-3">
        <Skeleton className="h-4 w-40" />
        {[0, 1, 2].map((i) => (
          <div
            className="flex items-start justify-between rounded-lg border border-border/30 bg-popover/60 p-2.5"
            key={i}
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-1 h-4 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Main content ----------------------------- */

function MCPServerSettingsPageContent({ params }: MCPServerSettingsPageProps) {
  const resolvedParams = use(params);
  const {
    servers: mcpServers,
    testServer: testMCPServer,
    updateServer: updateMCPServer,
    deleteServer: deleteMCPServer,
    isLoading: serversLoading,
  } = useMCPServers();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const server = mcpServers.find((s) => s.id === resolvedParams.id);
  const { mcpRegistry, isLoading: toolsLoading } = useAllTools();

  const loadingServer = !isMounted || serversLoading;
  const loadingTools = toolsLoading || loadingServer;

  const tools = useMemo(() => {
    if (!server || !server.isActive) {
      return [];
    }
    const metadata = mcpRegistry?.metadata || {};
    return Object.entries(metadata)
      .filter(([, meta]) => (meta as any).serverName === server.name)
      .map(([toolId, meta]) => ({
        id: toolId,
        name: (meta as any).toolName || toolId,
        description: (meta as any).description || "MCP tool",
        serverName: (meta as any).serverName as string | undefined,
      }));
  }, [mcpRegistry, server]);

  const getStatusIcon = () => {
    if (!server) {
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
    if (server.lastConnectionStatus === "connected") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (server.lastConnectionStatus === "failed") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (server.lastConnectionStatus === "testing") {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (!server) {
      return "Unknown";
    }
    if (server.lastConnectionStatus === "connected") {
      return "Connected";
    }
    if (server.lastConnectionStatus === "failed") {
      return "Failed";
    }
    if (server.lastConnectionStatus === "testing") {
      return "Testing…";
    }
    return "Not tested";
  };

  const getStatusVariant = () => {
    if (!server) {
      return "secondary" as const;
    }
    if (server.lastConnectionStatus === "connected") {
      return "default" as const;
    }
    if (server.lastConnectionStatus === "failed") {
      return "destructive" as const;
    }
    if (server.lastConnectionStatus === "testing") {
      return "secondary" as const;
    }
    return "outline" as const;
  };

  const handleTest = async () => {
    if (!server) {
      return;
    }
    try {
      toast.loading("Testing connection...", { id: "test-mcp-server" });
      const result = await testMCPServer({
        id: server.id,
        url: server.url,
        headers: server.headers,
      });

      if (result.connected) {
        toast.success(
          `Connected successfully! Found ${result.tools ? Object.keys(result.tools).length : 0} tools.`,
          { id: "test-mcp-server" }
        );
      } else {
        toast.error("Connection failed. Check the error details below.", {
          id: "test-mcp-server",
        });
      }
    } catch (error) {
      let errorMessage = "Failed to test server";

      if (error instanceof Error) {
        // Extract the actual error cause if available
        errorMessage = (error as any).cause || error.message;
      }

      toast.error(`Connection test failed: ${errorMessage}`, {
        id: "test-mcp-server",
      });
      console.error("Failed to test server:", error);
    }
  };

  const handleToggleActive = async () => {
    if (!server) {
      return;
    }
    try {
      const newState = !server.isActive;
      await updateMCPServer({ id: server.id, isActive: newState });
      toast.success(`Server ${newState ? "enabled" : "disabled"} successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? (error as any).cause || error.message
          : "Unknown error";
      toast.error(`Failed to update server: ${errorMessage}`);
      console.error("Failed to update server:", error);
    }
  };

  const handleDelete = async () => {
    if (!server) {
      return;
    }
    if (confirm("Are you sure you want to delete this MCP server?")) {
      try {
        toast.loading("Deleting server...", { id: "delete-mcp-server" });
        await deleteMCPServer(server.id);
        toast.success("Server deleted successfully", {
          id: "delete-mcp-server",
        });
        window.location.href = "/settings/mcp-servers";
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? (error as any).cause || error.message
            : "Unknown error";
        toast.error(`Failed to delete server: ${errorMessage}`, {
          id: "delete-mcp-server",
        });
        console.error("Failed to delete server:", error);
      }
    }
  };

  // Not found
  if (!loadingServer && !server) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-10 text-center">
        <h1 className="mb-1 font-semibold text-2xl text-foreground">
          Server Not Found
        </h1>
        <p className="mb-5 text-muted-foreground">
          The MCP server you’re looking for doesn’t exist or has been deleted.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/mcp-servers">Back to MCP Servers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header Bar (replaces big header card) */}
      <div className="sticky top-0 z-10 w-full border-border/30 border-b bg-popover/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-2">
          {loadingServer || !server ? (
            <>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="truncate">
                  <div className="truncate font-semibold text-base leading-tight">
                    {server.name}
                  </div>
                  {server.description && (
                    <div className="truncate text-muted-foreground text-xs">
                      {server.description}
                    </div>
                  )}
                </div>
                <Badge
                  className="ml-1 flex items-center gap-1"
                  variant={getStatusVariant()}
                >
                  {getStatusIcon()}
                  {getStatusText()}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  disabled={server.lastConnectionStatus === "testing"}
                  onClick={handleTest}
                  size="sm"
                  variant="outline"
                >
                  <TestTube className="mr-1.5 h-4 w-4" />
                  Test
                </Button>
                <Button
                  onClick={handleToggleActive}
                  size="sm"
                  variant="outline"
                >
                  {server.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  className="text-destructive"
                  onClick={handleDelete}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Grid: left = details, right = connection meta */}
      <div className="mx-auto grid max-w-5xl gap-6 px-3 md:grid-cols-[1.2fr_1fr]">
        {/* Left: URL + quick facts as lightweight tiles */}
        <section className="space-y-4">
          {/* URL Row */}
          <div className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
            <div className="font-medium text-muted-foreground text-xs">
              Server URL
            </div>
            {loadingServer || !server ? (
              <div className="mt-2 flex items-center gap-1.5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-8" />
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="flex-1 break-all rounded-md bg-muted px-2.5 py-2 text-xs">
                  {server.url}
                </code>
                <Button
                  className="h-8 w-8"
                  onClick={() => window.open(server.url, "_blank")}
                  size="icon"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Quick facts tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile
              label="Status"
              loading={loadingServer || !server}
              value={
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="text-sm">{getStatusText()}</span>
                </div>
              }
            />
            <InfoTile
              label="Active"
              loading={loadingServer || !server}
              value={
                <Badge variant={server?.isActive ? "default" : "secondary"}>
                  {server?.isActive ? "Yes" : "No"}
                </Badge>
              }
            />
            {server?.toolCount !== undefined && (
              <InfoTile
                label="Available Tools"
                loading={loadingServer || !server}
                value={
                  <span className="font-medium text-sm">
                    {server.toolCount}
                  </span>
                }
              />
            )}
          </div>
        </section>

        {/* Right: connection meta (no heavy cards, just a framed section) */}
        <section className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
          <div className="font-semibold text-sm">Connection</div>
          <div className="mt-2 space-y-3">
            {loadingServer || !server ? (
              <>
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-56" />
                <Skeleton className="h-9 w-full" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
              </>
            ) : (
              <>
                {server.lastConnectionTest && (
                  <KV label="Last Tested">
                    {new Date(server.lastConnectionTest).toLocaleString()}
                  </KV>
                )}

                {server.lastError && (
                  <div>
                    <div className="font-medium text-muted-foreground text-xs">
                      Last Error
                    </div>
                    <code className="mt-1 block break-all rounded-md bg-destructive/10 px-2.5 py-2 text-destructive text-xs">
                      {server.lastError}
                    </code>
                  </div>
                )}

                {server.headers && Object.keys(server.headers).length > 0 && (
                  <div>
                    <div className="font-medium text-muted-foreground text-xs">
                      Custom Headers
                    </div>
                    <div className="mt-1 space-y-1">
                      {Object.entries(server.headers).map(([key, value]) => (
                        <div
                          className="flex items-center gap-2 text-xs"
                          key={key}
                        >
                          <span className="font-mono text-muted-foreground">
                            {key}:
                          </span>
                          <span className="font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <KV label="Created">
                    {new Date(server.createdAt).toLocaleString()}
                  </KV>
                  <KV label="Last Updated">
                    {new Date(server.updatedAt).toLocaleString()}
                  </KV>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Tools */}
      <section className="mx-auto max-w-5xl space-y-2 px-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">Available Tools</div>
          {!loadingTools && tools.length > 0 && (
            <div className="flex items-center gap-1.5">
              {/* Example bulk actions (outline + sm) — wire up if you add handlers */}
              {/* <Button size="sm" variant="outline">Select all</Button>
              <Button size="sm" variant="outline">Clear</Button> */}
            </div>
          )}
        </div>

        {loadingTools ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                className="flex items-start justify-between rounded-lg border border-border/30 bg-popover/60 p-2.5"
                key={i}
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-1 h-3.5 w-48" />
                  <Skeleton className="h-3.5 w-64" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : tools.length === 0 ? (
          <div className="rounded-xl border border-border/40 border-dashed p-6 text-center">
            <div className="text-muted-foreground text-sm">
              No tools available
            </div>
            <div className="mt-1 text-muted-foreground text-xs">
              {server?.isActive
                ? "This server doesn’t provide any tools"
                : "Server is not active"}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map((tool) => (
              <MCPToolToggle
                key={tool.id}
                serverName={tool.serverName}
                tool={tool}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function MCPServerSettingsPage(
  props: MCPServerSettingsPageProps
) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MCPServerSettingsPageContent {...props} />
    </Suspense>
  );
}

/* ----------------------------- Small pieces ----------------------------- */

function InfoTile({
  loading,
  label,
  value,
}: {
  loading: boolean;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
      <div className="font-medium text-muted-foreground text-xs">{label}</div>
      <div className="mt-1">
        {loading ? <Skeleton className="h-4 w-24" /> : value}
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-medium text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function MCPToolToggle({
  tool,
  serverName,
}: {
  tool: { id: string; name: string; description?: string };
  serverName?: string;
}) {
  const { selectedTools, toggleTool } = useSharedSelectedTools({
    resolveToolType: () => TOOL_TYPES.MCP,
  });

  const isActive = selectedTools.includes(tool.id);

  const handleToggle = () => {
    const next = toggleTool(tool.id);

    // Invalidate SWR cache so other components pick up the change
    mutate("/api/tools").catch((err) => {
      console.error("[MCP_SETTINGS] Failed to invalidate tools cache:", err);
    });

    toast.success(
      isActive ? `Deactivated ${tool.name}` : `Activated ${tool.name}`
    );
  };

  return (
    <div className="flex items-start justify-between rounded-lg border border-border/30 bg-popover/60 p-2.5">
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-medium text-sm">{tool.name}</span>
          <Badge className="text-[10px]" variant="secondary">
            MCP
          </Badge>
          {serverName ? (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {serverName}
            </span>
          ) : null}
        </div>
        {tool.description ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {tool.description}
          </p>
        ) : null}
      </div>
      <Button
        className={isActive ? "border-destructive text-destructive" : undefined}
        onClick={handleToggle}
        size="sm"
        variant="outline"
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
