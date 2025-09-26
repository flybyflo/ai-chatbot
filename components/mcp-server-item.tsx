"use client";

import {
  CheckCircle,
  Clock,
  Edit,
  Eye,
  EyeOff,
  MoreVertical,
  TestTube,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserMCPServer } from "@/hooks/use-mcp-servers";
import { useMCPServers } from "@/hooks/use-mcp-servers";
import { cn } from "@/lib/utils";
import { toast } from "./toast";

type MCPServerItemProps = {
  server: UserMCPServer;
  onUpdate: (data: {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    isActive?: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function MCPServerItem({
  server,
  onUpdate,
  onDelete,
}: MCPServerItemProps) {
  const { testMCPServer } = useMCPServers();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(server.name);
  const [url, setUrl] = useState(server.url);
  const [description, setDescription] = useState(server.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate({
        id: server.id,
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update MCP server:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(server.name);
    setUrl(server.url);
    setDescription(server.description || "");
    setIsEditing(false);
  };

  const handleToggleActive = async () => {
    try {
      await onUpdate({
        id: server.id,
        isActive: !server.isActive,
      });
    } catch (error) {
      console.error("Failed to toggle MCP server:", error);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this MCP server?")) {
      try {
        await onDelete(server.id);
      } catch (error) {
        console.error("Failed to delete MCP server:", error);
      }
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await testMCPServer({
        id: server.id,
        url: server.url,
        headers: server.headers,
      });

      if (result.connected) {
        toast({
          type: "success",
          description: `Connected successfully! Found ${result.server.toolCount} tools.`,
        });
      } else {
        toast({
          type: "error",
          description: result.server.lastError || "Connection failed",
        });
      }
    } catch (error) {
      toast({
        type: "error",
        description: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (isTesting || server.lastConnectionStatus === "testing") {
      return <Clock className="h-4 w-4 animate-spin text-blue-500" />;
    }

    switch (server.lastConnectionStatus) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <TestTube className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (isTesting || server.lastConnectionStatus === "testing") {
      return "Testing...";
    }

    switch (server.lastConnectionStatus) {
      case "connected":
        return `Connected (${server.toolCount || 0} tools)`;
      case "failed":
        return "Connection failed";
      default:
        return "Not tested";
    }
  };

  return (
    <Card
      className={cn("transition-opacity", !server.isActive && "opacity-60")}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {isEditing ? (
          <Input
            className="font-semibold"
            onChange={(e) => setName(e.target.value)}
            placeholder="Server name..."
            value={name}
          />
        ) : (
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{server.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-muted-foreground text-xs">
                {getStatusText()}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button
              className="h-8 w-8 p-0"
              disabled={isTesting}
              onClick={handleTest}
              size="sm"
              variant="ghost"
            >
              <TestTube className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive}>
                {server.isActive ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Input
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Server URL..."
              type="url"
              value={url}
            />
            <Textarea
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              value={description}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={handleCancel} size="sm" variant="outline">
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !url.trim() || isSaving}
                onClick={handleSave}
                size="sm"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {server.url}
              </code>
            </div>
            {server.description && (
              <p className="text-muted-foreground text-sm">
                {server.description}
              </p>
            )}
            {server.lastError && (
              <p className="mt-2 text-red-500 text-xs">
                Error: {server.lastError}
              </p>
            )}
            {!server.isActive && (
              <p className="mt-2 text-muted-foreground text-xs italic">
                This server is disabled and won't be used in conversations.
              </p>
            )}
            {server.lastConnectionTest && (
              <p className="text-muted-foreground text-xs">
                Last tested:{" "}
                {new Date(server.lastConnectionTest).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
