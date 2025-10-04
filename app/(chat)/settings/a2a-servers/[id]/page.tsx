"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useA2AClient } from "@/hooks/use-a2a-client";

/* -------------------------------- Types -------------------------------- */

type LogItem =
  | { type: "api"; ts: number; line: string }
  | { type: "request"; ts: number; payload: unknown }
  | { type: "error"; ts: number; payload: unknown };

/* ------------------------------- Component ------------------------------ */

export default function A2AServerDetailPage() {
  const router = useRouter();
  const [consoleLogs, setConsoleLogs] = useState<LogItem[]>([]);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"main" | "dialog" | null>(
    null
  );

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

  const handleCopy = async (text: string, type: "main" | "dialog") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Normalize agent card to support camelCase & snake_case
  const normCard = useMemo(() => {
    if (!agentCard) {
      return null;
    }
    const inputModes =
      agentCard.default_input_modes ?? agentCard.defaultInputModes ?? [];
    const outputModes =
      agentCard.default_output_modes ?? agentCard.defaultOutputModes ?? [];
    const version = agentCard.protocolVersion ?? agentCard.version;
    const url = agentCard.url;
    const streaming = !!agentCard.capabilities?.streaming;
    const skills = Array.isArray(agentCard.skills) ? agentCard.skills : [];
    const preferredTransport = agentCard.preferredTransport;
    const description = agentCard.description;
    const pretty = JSON.stringify(agentCard, null, 2);
    return {
      inputModes,
      outputModes,
      version,
      url,
      streaming,
      skills,
      preferredTransport,
      description,
      pretty,
    };
  }, [agentCard]);

  const cardBadges = useMemo(() => {
    if (!normCard) {
      return null;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        <SmallBadge positive>Card fetched</SmallBadge>
        <SmallBadge positive={normCard.streaming}>
          Streaming {normCard.streaming ? "on" : "off"}
        </SmallBadge>
        <SmallBadge positive={normCard.inputModes.length > 0}>
          Input modes
        </SmallBadge>
        <SmallBadge positive={normCard.outputModes.length > 0}>
          Output modes
        </SmallBadge>
        <SmallBadge positive={normCard.skills.length > 0}>Skills</SmallBadge>
      </div>
    );
  }, [normCard]);

  return (
    <>
      <div className="space-y-6">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 w-full border-border/30 border-b bg-popover/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-base">
                A2A Server Details
              </h1>
              <p className="truncate text-muted-foreground text-xs">
                Inspect agent configuration and card.
              </p>
            </div>
            <Button
              disabled={!isReady || !server}
              onClick={handleTestChat}
              size="sm"
              title={
                isReady
                  ? server
                    ? "Send sample message"
                    : "No server"
                  : "Client not ready"
              }
              variant="outline"
            >
              Send sample message
            </Button>
          </div>
        </div>

        {/* Stack sections vertically for breathing room */}
        <div className="mx-auto max-w-4xl space-y-6 px-3">
          {/* SERVER */}
          <section className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
            <SectionTitle>Server</SectionTitle>

            {loadingServer ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : server ? (
              <dl className="mt-1 grid gap-2">
                <KV label="Name">{server.name}</KV>
                <KV label="Card URL">
                  <CodeChip>{server.cardUrl}</CodeChip>
                </KV>
                {server.description ? (
                  <KV label="Description">{server.description}</KV>
                ) : null}
                <KV label="Active">
                  <Badge variant={server.isActive ? "default" : "secondary"}>
                    {server.isActive ? "Yes" : "No"}
                  </Badge>
                </KV>
                <KV label="Last Test">
                  {server.lastConnectionTest
                    ? new Date(server.lastConnectionTest).toLocaleString()
                    : "—"}
                </KV>
                <KV label="Status">{server.lastConnectionStatus || "—"}</KV>
                <KV label="Last Error">
                  {server.lastError ? (
                    <code className="block break-all rounded border border-border/30 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive">
                      {server.lastError}
                    </code>
                  ) : (
                    "—"
                  )}
                </KV>
              </dl>
            ) : (
              <div className="mt-2 text-red-500 text-sm">Server not found</div>
            )}
          </section>

          {/* AGENT CARD */}
          <section className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
            <div className="mb-1.5 flex items-center justify-between">
              <SectionTitle className="mb-0">Agent Card</SectionTitle>
              {normCard && (
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => setJsonOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    Show raw JSON
                  </Button>
                  <Button
                    onClick={() => handleCopy(normCard.pretty, "main")}
                    size="sm"
                    variant="outline"
                  >
                    {copyFeedback === "main" ? "Copied!" : "Copy JSON"}
                  </Button>
                </div>
              )}
            </div>

            {loadingCard ? (
              <div className="mt-3 text-muted-foreground text-sm">
                Loading agent card…
              </div>
            ) : cardError ? (
              <div className="mt-3 text-red-500 text-sm">
                Failed to fetch card
              </div>
            ) : normCard ? (
              <div className="mt-1 space-y-3">
                {cardBadges}

                <dl className="grid gap-2 text-sm">
                  <KV label="Name">{agentCard.name}</KV>
                  <KV label="URL">
                    <CodeChip>{normCard.url}</CodeChip>
                  </KV>
                  <KV label="Version">{normCard.version}</KV>
                  {normCard.preferredTransport && (
                    <KV label="Transport">{normCard.preferredTransport}</KV>
                  )}
                  <KV label="Capabilities (streaming)">
                    {normCard.streaming ? "Yes" : "No"}
                  </KV>
                  <KV label="Default input modes">
                    <WrapList items={normCard.inputModes} />
                  </KV>
                  <KV label="Default output modes">
                    <WrapList items={normCard.outputModes} />
                  </KV>
                  <KV label="Skills">
                    <WrapList
                      items={normCard.skills.map((s: any) => s.name || s.id)}
                    />
                  </KV>
                  {normCard.description && (
                    <KV label="Description">{normCard.description}</KV>
                  )}
                </dl>
              </div>
            ) : (
              <div className="mt-3 text-muted-foreground text-sm">No card</div>
            )}
          </section>

          {/* DEBUG CONSOLE */}
          <section className="rounded-xl border border-border/30 bg-popover/70 p-3 shadow-sm backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <SectionTitle className="mb-0">Debug Console</SectionTitle>
              <Button
                disabled={!isReady || !server}
                onClick={handleTestChat}
                size="sm"
                title={
                  isReady
                    ? server
                      ? "Send sample message"
                      : "No server"
                    : "Client not ready"
                }
                variant="outline"
              >
                Send sample message
              </Button>
            </div>

            <Tabs className="mt-1" defaultValue="logs">
              <TabsList className="w-fit">
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-2" value="logs">
                {consoleLogs.length === 0 ? (
                  <div className="rounded-lg border border-border/30 bg-background/60 p-3 text-muted-foreground text-xs">
                    No logs yet.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {consoleLogs.map((l, i) => (
                      <LogRow item={l} key={`${l.type}-${l.ts}-${i}`} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>

      {/* JSON Dialog */}
      <Dialog onOpenChange={setJsonOpen} open={jsonOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Agent Card (raw JSON)</DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-border/30 bg-background/60 p-2">
            <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed">
              {normCard?.pretty ?? ""}
            </pre>
          </div>

          <div className="flex justify-end gap-1.5">
            <Button
              disabled={!normCard}
              onClick={() => handleCopy(normCard?.pretty ?? "", "dialog")}
              size="sm"
              variant="outline"
            >
              {copyFeedback === "dialog" ? "Copied!" : "Copy"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------------- UI ---------------------------------- */

function SectionTitle({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={["mb-1.5 font-semibold text-sm", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function KV({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] items-start gap-2">
      <dt className="font-medium text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function CodeChip({ children }: React.PropsWithChildren) {
  return (
    <code className="inline break-all rounded border border-border/30 bg-background/60 px-1.5 py-0.5 font-mono text-[11px]">
      {children}
    </code>
  );
}

function SmallBadge({
  children,
  positive,
}: React.PropsWithChildren<{ positive?: boolean }>) {
  return (
    <Badge
      className="px-1.5 py-0.5 text-[10px]"
      variant={positive ? "default" : "secondary"}
    >
      {children}
    </Badge>
  );
}

function WrapList({ items }: { items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <span>—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x, i) => (
        <Badge
          className="px-1.5 py-0.5 text-[10px]"
          key={`${String(x)}-${i}`}
          variant="secondary"
        >
          {String(x)}
        </Badge>
      ))}
    </div>
  );
}

function LogRow({ item }: { item: LogItem }) {
  const time = new Date(item.ts).toLocaleTimeString();
  let badgeText = "LOG";
  let badgeVariant: "default" | "secondary" | "destructive" = "secondary";
  let body: React.ReactNode = null;

  if (item.type === "api") {
    badgeText = "API";
    badgeVariant = "default";
    body = <span className="font-mono text-[11px]">{item.line}</span>;
  } else if (item.type === "request") {
    badgeText = "REQ";
    badgeVariant = "default";
    body = (
      <pre className="max-w-full overflow-auto font-mono text-[11px]">
        {JSON.stringify(item.payload, null, 2)}
      </pre>
    );
  } else if (item.type === "error") {
    badgeText = "ERR";
    badgeVariant = "destructive";
    body = (
      <pre className="max-w-full overflow-auto font-mono text-[11px]">
        {JSON.stringify(item.payload, null, 2)}
      </pre>
    );
  }

  return (
    <li className="flex items-start gap-2 rounded border border-border/30 bg-background/60 p-2">
      <Badge className="px-1.5 py-0.5 text-[10px]" variant={badgeVariant}>
        {badgeText}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] text-muted-foreground">{time}</div>
        <div className="min-w-0 text-xs">{body}</div>
      </div>
    </li>
  );
}
