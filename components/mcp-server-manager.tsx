"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMCPServers } from "@/hooks/use-mcp-servers";
import { toast } from "./toast";
import { Card, CardContent } from "./ui/card";
export function MCPServerManager() {
  const {
    mcpServers,
    isLoading,
    hasCached,
    createMCPServer,
    updateMCPServer,
    deleteMCPServer,
    testMCPServer,
    isCreating: isCreatingServer,
  } = useMCPServers();
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await createMCPServer({
        name: newName.trim(),
        url: newUrl.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewUrl("");
      setNewDescription("");
      toast({
        type: "success",
        description: "MCP server created successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create MCP server",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    isActive?: boolean;
  }) => {
    try {
      await updateMCPServer(data);
      toast({
        type: "success",
        description: "MCP server updated successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update MCP server",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMCPServer(id);
      toast({
        type: "success",
        description: "MCP server deleted successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete MCP server",
      });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const server = mcpServers.find((s) => s.id === id);
      if (!server) {
        return;
      }

      await testMCPServer({
        id: server.id,
        url: server.url,
        headers: server.headers,
      });
      toast({
        type: "success",
        description: "MCP server test completed",
      });
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to test MCP server",
      });
    }
  };

  return (
    <div className="space-y-6">
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

        {/* Add Server Button */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="group relative col-span-1 flex transform-gpu flex-col justify-center overflow-hidden rounded-xl bg-background transition-all duration-300 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
              type="button"
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
            </button>
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
              <div className="flex justify-end gap-2">
                <Button
                  disabled={
                    !newName.trim() ||
                    !newUrl.trim() ||
                    isSaving ||
                    isCreatingServer
                  }
                  onClick={handleCreate}
                >
                  {isSaving || isCreatingServer ? "Adding..." : "Add Server"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading && !hasCached && mcpServers.length === 0 && (
        <div className="space-y-3">
          <Card>
            <CardContent className="py-6">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
