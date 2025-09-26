"use client";

import { Plus, Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useMCPServers } from "@/hooks/use-mcp-servers";
import { MCPServerItem } from "./mcp-server-item";
import { toast } from "./toast";

export function MCPServerManager() {
  const {
    mcpServers,
    isLoading,
    createMCPServer,
    updateMCPServer,
    deleteMCPServer,
  } = useMCPServers();
  const [isCreating, setIsCreating] = useState(false);
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
      setIsCreating(false);
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

  const activeServers = mcpServers.filter((server) => server.isActive);
  const inactiveServers = mcpServers.filter((server) => !server.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Server className="h-5 w-5" />
        <h1 className="font-semibold text-xl">MCP Server Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About MCP Servers</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p>
            Model Context Protocol (MCP) servers provide additional tools and
            capabilities to your AI assistant. Add and configure external MCP
            servers to extend functionality. Only active servers will be
            available during conversations.
          </p>
        </CardContent>
      </Card>

      {/* Create New MCP Server */}
      {isCreating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add New MCP Server</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button onClick={() => setIsCreating(false)} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={!newName.trim() || !newUrl.trim() || isSaving}
                onClick={handleCreate}
              >
                {isSaving ? "Adding..." : "Add Server"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full" onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New MCP Server
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground text-sm">
            Loading MCP servers...
          </div>
        </div>
      ) : (
        <>
          {/* Active Servers */}
          {activeServers.length > 0 && (
            <div>
              <h2 className="mb-3 font-medium text-foreground text-sm">
                Active Servers ({activeServers.length})
              </h2>
              <div className="space-y-3">
                {activeServers.map((server) => (
                  <MCPServerItem
                    key={server.id}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    server={server}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Servers */}
          {inactiveServers.length > 0 && (
            <>
              {activeServers.length > 0 && <Separator />}
              <div>
                <h2 className="mb-3 font-medium text-muted-foreground text-sm">
                  Disabled Servers ({inactiveServers.length})
                </h2>
                <div className="space-y-3">
                  {inactiveServers.map((server) => (
                    <MCPServerItem
                      key={server.id}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                      server={server}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {mcpServers.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Server className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-medium">No MCP servers yet</h3>
                <p className="mb-4 text-muted-foreground text-sm">
                  Add your first MCP server to extend your AI assistant with
                  additional tools and capabilities.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Server
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
