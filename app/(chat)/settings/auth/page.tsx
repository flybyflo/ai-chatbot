"use client";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export default function AuthSettingsPage() {
  const issueMcpToken = useAction(api.auth.issueMcpToken);
  const currentUser = useQuery(api.auth.getCurrentUser, {});

  const [minting, setMinting] = useState(false);
  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [jwksLoading, setJwksLoading] = useState(false);
  const [jwksResult, setJwksResult] = useState<string | null>(null);
  const [jwksError, setJwksError] = useState<string | null>(null);

  const handleMintToken = async () => {
    setMinting(true);
    setTokenError(null);
    try {
      const result = await issueMcpToken({});
      setTokenResult(result.access_token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setTokenResult(null);
      setTokenError(message);
    } finally {
      setMinting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!tokenResult) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenResult);
    } catch (error) {
      console.error("Failed to copy token", error);
    }
  };

  const handleFetchJwks = async () => {
    setJwksLoading(true);
    setJwksError(null);
    try {
      const response = await fetch("/api/auth/jwks");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      setJwksResult(JSON.stringify(json, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setJwksResult(null);
      setJwksError(message);
    } finally {
      setJwksLoading(false);
    }
  };

  return (
    <div className="mb-8 space-y-6">
      <header className="space-y-2">
        <h1 className="font-bold text-3xl text-foreground">Auth Console</h1>
        <p className="text-muted-foreground">
          Inspect Better Auth state and mint short-lived MCP access tokens for
          local debugging.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex h-full flex-col gap-4 rounded-lg border border-border bg-background/60 p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-xl">
              Mint MCP token
            </h2>
            <p className="text-muted-foreground text-sm">
              Calls the Convex action <code>auth.issueMcpToken</code> using your
              current Better Auth session.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={minting} onClick={handleMintToken}>
              {minting ? "Minting…" : "Mint token"}
            </Button>
            <Button
              disabled={!tokenResult}
              onClick={handleCopyToken}
              variant="outline"
            >
              Copy token
            </Button>
          </div>

          <div className="flex-1 overflow-hidden rounded-md border border-border bg-muted/40 p-3">
            {tokenResult ? (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">
                {tokenResult}
              </pre>
            ) : (
              <p className="text-muted-foreground text-xs">
                {tokenError ? `Error: ${tokenError}` : "No token minted yet."}
              </p>
            )}
          </div>
        </section>

        <section className="flex h-full flex-col gap-4 rounded-lg border border-border bg-background/60 p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-xl">
              Fetch JWKS
            </h2>
            <p className="text-muted-foreground text-sm">
              Query the public JWKS endpoint served by Convex to verify key
              rollover.
            </p>
          </div>

          <Button disabled={jwksLoading} onClick={handleFetchJwks}>
            {jwksLoading ? "Loading…" : "Fetch /api/auth/jwks"}
          </Button>

          <div className="flex-1 overflow-hidden rounded-md border border-border bg-muted/40 p-3">
            {jwksResult ? (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">
                {jwksResult}
              </pre>
            ) : (
              <p className="text-muted-foreground text-xs">
                {jwksError
                  ? `Error: ${jwksError}`
                  : "Press the button to load the JWKS payload."}
              </p>
            )}
          </div>
        </section>

        <section
          className={cn(
            "lg:col-span-2",
            "flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4 shadow-sm"
          )}
        >
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-xl">
              Current user
            </h2>
            <p className="text-muted-foreground text-sm">
              Displayed directly from the Convex query{" "}
              <code>auth.getCurrentUser</code>.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-muted/40 p-3">
            {currentUser === undefined ? (
              <p className="text-muted-foreground text-xs">Loading…</p>
            ) : currentUser ? (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(currentUser, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-xs">
                No authenticated Better Auth user detected.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
