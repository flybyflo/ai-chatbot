"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useA2AClient } from "@/hooks/use-a2a-client";

export default function A2AServerDetailPage() {
  const router = useRouter();
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const routeParams = useParams<{ id: string }>();
  const idParam = Array.isArray(routeParams?.id)
    ? routeParams?.id?.[0]
    : routeParams?.id;

  const fetchWithConsoleLog = async (path: string) => {
    const method = "GET";
    const started = Date.now();
    const res = await fetch(path);
    const ms = Date.now() - started;
    setConsoleLogs((prev) => [
      ...prev,
      {
        type: "api",
        ts: Date.now(),
        line: `${method} ${path} ${res.status} in ${ms}ms`,
      },
    ]);
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return res.json();
  };

  const { data: server, isLoading: loadingServer } = useQuery({
    queryKey: ["a2a-server", idParam],
    queryFn: async () => fetchWithConsoleLog(`/api/a2a-servers/${idParam}`),
    enabled: !!idParam,
  });

  const {
    data: agentCard,
    isLoading: loadingCard,
    error: cardError,
  } = useQuery({
    queryKey: ["a2a-server-card", idParam],
    queryFn: async () =>
      fetchWithConsoleLog(`/api/a2a-servers/${idParam}/card`),
    enabled: !!server && !!idParam,
  });

  useEffect(() => {
    if (!idParam) {
      router.replace("/settings/a2a-servers");
    }
  }, [idParam, router]);

  const { isReady, sendStreamingMessage } = useA2AClient();

  const handleTestChat = async () => {
    if (!server) {
      return;
    }
    setConsoleLogs((prev) => [
      ...prev,
      {
        type: "request",
        ts: Date.now(),
        payload: { text: "hello from inspector console" },
      },
    ]);
    try {
      await sendStreamingMessage(server.name, {
        text: "hello from inspector console",
      } as any);
    } catch (e) {
      setConsoleLogs((prev) => [
        ...prev,
        { type: "error", ts: Date.now(), payload: (e as Error).message },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">A2A Server Details</h1>
        <p className="text-muted-foreground">
          Inspect agent configuration and card.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Server</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingServer ? (
            <div className="text-muted-foreground text-sm">Loading server…</div>
          ) : server ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                {server.name}
              </div>
              <div>
                <span className="text-muted-foreground">Card URL:</span>{" "}
                {server.cardUrl}
              </div>
              {server.description ? (
                <div>
                  <span className="text-muted-foreground">Description:</span>{" "}
                  {server.description}
                </div>
              ) : null}
              <div>
                <span className="text-muted-foreground">Active:</span>{" "}
                {server.isActive ? "Yes" : "No"}
              </div>
              <div>
                <span className="text-muted-foreground">Last Test:</span>{" "}
                {server.lastConnectionTest
                  ? new Date(server.lastConnectionTest).toLocaleString()
                  : "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {server.lastConnectionStatus || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Last Error:</span>{" "}
                {server.lastError || "—"}
              </div>
            </div>
          ) : (
            <div className="text-red-500 text-sm">Server not found</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Card</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCard ? (
            <div className="text-muted-foreground text-sm">
              Loading agent card…
            </div>
          ) : cardError ? (
            <div className="text-red-500 text-sm">Failed to fetch card</div>
          ) : agentCard ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={agentCard ? "default" : "secondary"}>
                  Card fetched
                </Badge>
                <Badge
                  variant={
                    agentCard?.capabilities?.streaming ? "default" : "secondary"
                  }
                >
                  Streaming {agentCard?.capabilities?.streaming ? "on" : "off"}
                </Badge>
                <Badge
                  variant={
                    Array.isArray(agentCard?.default_input_modes) &&
                    agentCard.default_input_modes.length > 0
                      ? "default"
                      : "secondary"
                  }
                >
                  Input modes
                </Badge>
                <Badge
                  variant={
                    Array.isArray(agentCard?.default_output_modes) &&
                    agentCard.default_output_modes.length > 0
                      ? "default"
                      : "secondary"
                  }
                >
                  Output modes
                </Badge>
                <Badge
                  variant={
                    Array.isArray(agentCard?.skills) &&
                    agentCard.skills.length > 0
                      ? "default"
                      : "secondary"
                  }
                >
                  Skills
                </Badge>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Name:</span>{" "}
                {agentCard.name}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">URL:</span>{" "}
                {agentCard.url}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Version:</span>{" "}
                {agentCard.version}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Capabilities (streaming):
                </span>{" "}
                {agentCard.capabilities?.streaming ? "Yes" : "No"}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Default input modes:
                </span>{" "}
                {Array.isArray(agentCard.default_input_modes)
                  ? agentCard.default_input_modes.join(", ")
                  : agentCard.default_input_modes?.join?.(", ")}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Default output modes:
                </span>{" "}
                {Array.isArray(agentCard.default_output_modes)
                  ? agentCard.default_output_modes.join(", ")
                  : agentCard.default_output_modes?.join?.(", ")}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Skills:</span>{" "}
                {Array.isArray(agentCard.skills)
                  ? agentCard.skills.map((s: any) => s.name || s.id).join(", ")
                  : "—"}
              </div>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(agentCard, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">No card</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Console</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <Button
              disabled={!isReady || !server}
              onClick={handleTestChat}
              size="sm"
            >
              Send sample message
            </Button>
            <span className="text-muted-foreground text-xs">
              Sends a simple user text to this agent and logs events
            </span>
          </div>
          <Tabs defaultValue="logs">
            <TabsList>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="logs">
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                {consoleLogs.map((l) => JSON.stringify(l)).join("\n")}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
