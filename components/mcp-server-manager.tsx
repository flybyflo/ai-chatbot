"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BentoMCPServerCard } from "@/components/ui/bento-mcp-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useMCPServers } from "@/hooks/use-mcp-servers";

export function MCPServerManager() {
  const {
    servers: mcpServers,
    isLoading,
    createServer,
    updateServer,
    deleteServer,
    testServer,
  } = useMCPServers();
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [authMode, setAuthMode] = useState<"convex" | "manual">("convex");
  const [manualAccessToken, setManualAccessToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    const trimmedUrl = newUrl.trim();
    const trimmedToken = manualAccessToken.trim();
    if (!trimmedName || !trimmedUrl) {
      return;
    }
    if (authMode === "manual" && !trimmedToken) {
      return;
    }

    setIsSaving(true);
    try {
      await createServer({
        name: trimmedName,
        url: trimmedUrl,
        description: newDescription.trim() || undefined,
        authMode,
        accessToken: authMode === "manual" ? trimmedToken : undefined,
      });
      setNewName("");
      setNewUrl("");
      setNewDescription("");
      setAuthMode("convex");
      setManualAccessToken("");
      setIsDialogOpen(false);
      toast.success("MCP server created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create MCP server"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    authMode?: "convex" | "manual";
    accessToken?: string | null;
    isActive?: boolean;
  }) => {
    try {
      await updateServer(data);
      toast.success("MCP server updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update MCP server"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteServer(id);
      toast.success("MCP server deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete MCP server"
      );
    }
  };

  const handleTest = async (id: string) => {
    try {
      const server = mcpServers.find((s) => s.id === id);
      if (!server) {
        return;
      }

      await testServer({
        id: server.id,
        url: server.url,
        headers: server.headers,
      });
      toast.success("MCP server test completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to test MCP server"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">MCP Servers</h1>
        <p className="text-muted-foreground">
          Configure Model Context Protocol servers to extend AI capabilities.
        </p>
      </div>
      <div className="grid w-full auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* MCP Servers */}
        {mcpServers.map((server) => (
          <BentoMCPServerCard
            key={server.id}
            onDelete={handleDelete}
            onTest={handleTest}
            onUpdate={handleUpdate}
            server={server}
          />
        ))}

        {/* Loading State */}
        {isLoading && mcpServers.length === 0 && (
          <div className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-900/20" />
            <div className="relative p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-6 w-32 animate-pulse rounded bg-muted/50" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-4/6 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
            <div className="relative flex gap-2 p-4">
              <div className="h-8 flex-1 animate-pulse rounded bg-muted/50" />
              <div className="h-8 flex-1 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        )}

        {/* Add Server Button */}
        <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="group relative col-span-1 flex h-[18rem] transform-gpu flex-col justify-center overflow-hidden rounded-xl bg-background transition-all duration-300 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
              type="button"
              variant="ghost"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-900/20" />
              <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />

              <div className="flex h-full items-center justify-center p-4">
                <div className="text-center">
                  <Plus className="mx-auto mb-4 h-12 w-12 text-neutral-400 transition-colors duration-300 group-hover:text-neutral-600" />
                  <h3 className="font-semibold text-lg text-neutral-700 transition-colors duration-300 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100">
                    Add Server
                  </h3>
                </div>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New MCP Server</DialogTitle>
              <DialogDescription>
                Configure a new MCP server to extend your AI assistant's
                capabilities.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Server name (e.g., 'GitHub API')"
                value={newName}
              />
              <Input
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Server URL (e.g., 'http://localhost:3000/mcp')"
                type="url"
                value={newUrl}
              />
              <Textarea
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                value={newDescription}
              />
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Authentication</Label>
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-2"
                    onValueChange={(value: "convex" | "manual") =>
                      setAuthMode(value)
                    }
                    value={authMode}
                  >
                    <Label
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/40 p-2 text-sm"
                      htmlFor="auth-convex"
                    >
                      <RadioGroupItem id="auth-convex" value="convex" />
                      <span className="font-medium">Built-in auth</span>
                    </Label>
                    <Label
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-muted/40 p-2 text-sm"
                      htmlFor="auth-manual"
                    >
                      <RadioGroupItem id="auth-manual" value="manual" />
                      <span className="font-medium">Access token</span>
                    </Label>
                  </RadioGroup>
                  <p className="text-muted-foreground text-xs">
                    {authMode === "manual"
                      ? "We will send this token as a Bearer Authorization header."
                      : "Tokens are minted on demand using your Better Auth session."}
                  </p>
                </div>
                {authMode === "manual" && (
                  <Textarea
                    onChange={(e) => setManualAccessToken(e.target.value)}
                    placeholder="Paste access token"
                    rows={3}
                    value={manualAccessToken}
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={
                    !newName.trim() ||
                    !newUrl.trim() ||
                    isSaving ||
                    (authMode === "manual" && !manualAccessToken.trim())
                  }
                  onClick={handleCreate}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Server"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
