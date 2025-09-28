"use client";

import { useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMCPServers } from "@/hooks/use-mcp-servers";
import { useAllTools } from "@/hooks/use-tools";
import { useMCPServerStore } from "@/lib/stores/mcp-server-store";

type MCPServerSettingsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-4">
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-9 w-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-10" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </div>

        {/* Connection Information */}
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-48" />
          <div className="mt-4 space-y-4">
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-4 w-48" />
            </div>
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32" />
              <div className="mt-2 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
              <div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MCPServerSettingsPageContent({ params }: MCPServerSettingsPageProps) {
  const resolvedParams = use(params);
  const {
    mcpServers,
    testMCPServer,
    updateMCPServer,
    deleteMCPServer,
    isLoading: serversLoading,
    hasCached,
  } = useMCPServers();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const server = mcpServers.find((s) => s.id === resolvedParams.id);
  const { mcpRegistry, isLoading: toolsLoading } = useAllTools();
  // Only show loading if we don't have cached data and are actually loading
  const loadingServer = !isMounted || (serversLoading && !hasCached);
  const loadingTools = toolsLoading || loadingServer;
  const tools = useMemo(() => {
    if (!server || !server.isActive) {
      return [] as Array<{
        id: string;
        name: string;
        description?: string;
        serverName?: string;
      }>;
    }
    const metadata = mcpRegistry?.metadata || {};
    return Object.entries(metadata)
      .filter(([, meta]) => meta.serverName === server.name)
      .map(([toolId, meta]) => ({
        id: toolId,
        name: (meta as any).toolName || toolId,
        description: (meta as any).description || "MCP tool",
        serverName: (meta as any).serverName,
      }));
  }, [mcpRegistry, server]);

  const getStatusIcon = () => {
    if (!server) {
      return <Clock className="h-4 w-4 text-gray-400" />;
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
    return <Clock className="h-4 w-4 text-gray-400" />;
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
      return "Testing...";
    }
    return "Not tested";
  };

  const getStatusColor = () => {
    if (!server) {
      return "secondary";
    }

    if (server.lastConnectionStatus === "connected") {
      return "default";
    }
    if (server.lastConnectionStatus === "failed") {
      return "destructive";
    }
    if (server.lastConnectionStatus === "testing") {
      return "secondary";
    }
    return "outline";
  };

  const handleTest = async () => {
    if (!server) {
      return;
    }

    try {
      await testMCPServer({
        id: server.id,
        url: server.url,
        headers: server.headers,
      });
    } catch (error) {
      console.error("Failed to test server:", error);
    }
  };

  const handleToggleActive = async () => {
    if (!server) {
      return;
    }

    try {
      await updateMCPServer({
        id: server.id,
        isActive: !server.isActive,
      });
    } catch (error) {
      console.error("Failed to update server:", error);
    }
  };

  const handleDelete = async () => {
    if (!server) {
      return;
    }

    if (confirm("Are you sure you want to delete this MCP server?")) {
      try {
        await deleteMCPServer(server.id);
        // Redirect back to servers list
        window.location.href = "/settings/mcp-servers";
      } catch (error) {
        console.error("Failed to delete server:", error);
      }
    }
  };

  // Show server not found if server doesn't exist after hydration/data load
  if (!loadingServer && !server) {
    return (
      <div className="py-12 text-center">
        <h1 className="mb-2 font-semibold text-2xl text-gray-900 dark:text-gray-100">
          Server Not Found
        </h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          The MCP server you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/settings/mcp-servers">Back to MCP Servers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server Header */}
      <Card>
        <CardHeader>
          {loadingServer || !server ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="mt-2 h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-2xl">{server.name}</CardTitle>
                  {server.description && (
                    <p className="mt-1 text-muted-foreground">
                      {server.description}
                    </p>
                  )}
                </div>
                <Badge
                  className="flex items-center gap-1"
                  variant={getStatusColor()}
                >
                  {getStatusIcon()}
                  {getStatusText()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={server.lastConnectionStatus === "testing"}
                  onClick={handleTest}
                  size="sm"
                  variant="outline"
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
                <Button
                  onClick={handleToggleActive}
                  size="sm"
                  variant={server.isActive ? "destructive" : "default"}
                >
                  {server.isActive ? "Disable" : "Enable"}
                </Button>
                <Button onClick={handleDelete} size="sm" variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Server Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingServer || !server ? (
              <>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="font-medium text-muted-foreground text-sm">
                    Server URL
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-sm">
                      {server.url}
                    </code>
                    <Button
                      onClick={() => window.open(server.url, "_blank")}
                      size="sm"
                      variant="ghost"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="font-medium text-muted-foreground text-sm">
                    Status
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-sm">{getStatusText()}</span>
                  </div>
                </div>

                <div>
                  <div className="font-medium text-muted-foreground text-sm">
                    Active
                  </div>
                  <div className="mt-1">
                    <Badge variant={server.isActive ? "default" : "secondary"}>
                      {server.isActive ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>

                {server.toolCount !== undefined && (
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Available Tools
                    </div>
                    <div className="mt-1">
                      <span className="font-medium text-sm">
                        {server.toolCount}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Connection Information */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingServer || !server ? (
              <>
                <div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-4 w-48" />
                </div>
                <div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-32" />
                  <div className="mt-2 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="mt-2 h-4 w-40" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-4 w-40" />
                  </div>
                </div>
              </>
            ) : (
              <>
                {server.lastConnectionTest && (
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Last Tested
                    </div>
                    <div className="mt-1">
                      <span className="text-sm">
                        {new Date(server.lastConnectionTest).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {server.lastError && (
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Last Error
                    </div>
                    <div className="mt-1">
                      <code className="block break-all rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
                        {server.lastError}
                      </code>
                    </div>
                  </div>
                )}

                {server.headers && Object.keys(server.headers).length > 0 && (
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Custom Headers
                    </div>
                    <div className="mt-1 space-y-1">
                      {Object.entries(server.headers).map(([key, value]) => (
                        <div
                          className="flex items-center gap-2 text-sm"
                          key={key}
                        >
                          <span className="font-mono text-muted-foreground">
                            {key}:
                          </span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Created
                    </div>
                    <div className="mt-1">
                      <span className="text-sm">
                        {new Date(server.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-muted-foreground text-sm">
                      Last Updated
                    </div>
                    <div className="mt-1">
                      <span className="text-sm">
                        {new Date(server.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tools Section */}
      <Card>
        <CardHeader>
          <CardTitle>Available Tools</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTools ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ) : tools.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-muted-foreground text-sm">
                No tools available
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                {server?.isActive
                  ? "This server doesn't provide any tools"
                  : "Server is not active"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tools.map((tool) => (
                <MCPToolToggle
                  key={tool.id}
                  serverName={tool.serverName}
                  tool={tool}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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

function MCPToolToggle({
  tool,
  serverName,
}: {
  tool: { id: string; name: string; description?: string };
  serverName?: string;
}) {
  const queryClient = useQueryClient();
  const storeSelected = useMCPServerStore((s) => s.selectedTools);
  const setStoreSelected = useMCPServerStore((s) => s.setSelectedTools);
  const [selected, setSelected] = useState<string[]>(() => {
    const fromStore = useMCPServerStore.getState().selectedTools;
    if (fromStore && fromStore.length > 0) {
      return fromStore;
    }
    return (queryClient.getQueryData(["tools", "selected"]) as string[]) || [];
  });

  useEffect(() => {
    if (storeSelected && storeSelected.length > 0) {
      setSelected(storeSelected);
      return;
    }
    const cached =
      (queryClient.getQueryData(["tools", "selected"]) as string[]) || [];
    setSelected(cached);
  }, [queryClient, storeSelected]);

  const isActive = selected.includes(tool.id);

  const toggle = () => {
    const next = isActive
      ? selected.filter((t) => t !== tool.id)
      : [...selected, tool.id];
    setSelected(next);
    queryClient.setQueryData(["tools", "selected"], next);
    setStoreSelected(next);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-medium text-sm">{tool.name}</span>
          <Badge className="text-xs" variant="secondary">
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
        onClick={toggle}
        size="sm"
        variant={isActive ? "destructive" : "default"}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
