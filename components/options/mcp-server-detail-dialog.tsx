'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Server, Wrench, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  authToken?: string;
  description?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MCPServerWithStatus extends MCPServer {
  status?: 'connected' | 'disabled' | 'error' | 'loading' | 'auth_required';
  tools?: MCPTool[];
  lastChecked?: Date;
  error?: string;
}

interface MCPServerFormData {
  name: string;
  url: string;
  authToken: string;
  description: string;
}

interface MCPServerDetailDialogProps {
  serverId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onServerDeleted?: () => void;
}

export function MCPServerDetailDialog({
  serverId,
  isOpen,
  onClose,
  onServerDeleted,
}: MCPServerDetailDialogProps) {
  const [server, setServer] = useState<MCPServerWithStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    url: '',
    authToken: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [authRequiredServer, setAuthRequiredServer] =
    useState<MCPServer | null>(null);
  const [authToken, setAuthToken] = useState('');

  // Fetch tools for the server
  const fetchServerTools = useCallback(async (id: string) => {
    setLoadingTools(true);

    try {
      const response = await fetch(`/api/mcp-servers/${id}/tools`);
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }

      const data = await response.json();

      setServer((prev) => {
        if (!prev) return null;

        const newStatus = data.status as
          | 'connected'
          | 'disabled'
          | 'error'
          | 'auth_required';

        // If auth is required, open the auth dialog
        if (newStatus === 'auth_required') {
          setAuthRequiredServer(prev);
          setAuthToken(prev.authToken || '');
        }

        return {
          ...prev,
          status: newStatus,
          tools: data.tools || [],
          lastChecked: data.lastChecked
            ? new Date(data.lastChecked)
            : undefined,
          error: data.error,
        };
      });
    } catch (err) {
      console.error(`Error fetching tools for server ${id}:`, err);
      setServer((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to fetch tools',
        };
      });
    } finally {
      setLoadingTools(false);
    }
  }, []);

  const fetchServerDetails = useCallback(async () => {
    if (!serverId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/mcp-servers');
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }

      const data = await response.json();
      const foundServer = (data.servers || []).find(
        (s: MCPServer) => s.id === serverId,
      );

      if (!foundServer) {
        throw new Error('Server not found');
      }

      const serverWithStatus: MCPServerWithStatus = {
        ...foundServer,
        status: foundServer.isEnabled ? 'loading' : 'disabled',
        tools: [],
        createdAt: new Date(foundServer.createdAt),
        updatedAt: new Date(foundServer.updatedAt),
      };

      setServer(serverWithStatus);

      // Fetch tools if enabled
      if (foundServer.isEnabled) {
        fetchServerTools(serverId);
      }
    } catch (err) {
      console.error('Error fetching server details:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch server details',
      );
    } finally {
      setLoading(false);
    }
  }, [serverId, fetchServerTools]);

  // Fetch server details when dialog opens
  useEffect(() => {
    if (isOpen && serverId) {
      fetchServerDetails();
    } else if (!isOpen) {
      // Reset state when dialog closes
      setServer(null);
      setError(null);
      setEditingServer(null);
      setAuthRequiredServer(null);
    }
  }, [isOpen, serverId, fetchServerDetails]);

  const openEditDialog = (server: MCPServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      url: server.url,
      authToken: server.authToken || '',
      description: server.description || '',
    });
  };

  const handleEditServer = async () => {
    if (!editingServer || !formData.name.trim() || !formData.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    setSubmitting(true);
    try {
      const updateData: any = {
        id: editingServer.id,
        name: formData.name.trim(),
        url: formData.url.trim(),
      };

      // Only include optional fields if they have values
      if (formData.authToken.trim()) {
        updateData.authToken = formData.authToken.trim();
      }
      if (formData.description.trim()) {
        updateData.description = formData.description.trim();
      }

      const response = await fetch('/api/mcp-servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update server');
      }

      toast.success('MCP server updated successfully');
      setEditingServer(null);

      // Refresh server details
      await fetchServerDetails();
    } catch (err) {
      console.error('Error updating MCP server:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to update server',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteServer = async (server: MCPServer) => {
    if (!confirm(`Are you sure you want to delete "${server.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp-servers?id=${server.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete server');
      }

      toast.success('MCP server deleted successfully');
      onServerDeleted?.();
      onClose();
    } catch (err) {
      console.error('Error deleting MCP server:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete server',
      );
    }
  };

  const handleUpdateAuthToken = async () => {
    if (!authRequiredServer) return;

    setSubmitting(true);
    try {
      const updateData: any = {
        id: authRequiredServer.id,
        name: authRequiredServer.name,
        url: authRequiredServer.url,
        authToken: authToken.trim() || undefined,
      };

      // Only include description if it's not null/undefined
      if (authRequiredServer.description) {
        updateData.description = authRequiredServer.description;
      }

      const response = await fetch('/api/mcp-servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update auth token');
      }

      toast.success('Auth token updated successfully');
      setAuthRequiredServer(null);
      setAuthToken('');

      // Refresh server status
      if (server) {
        setServer((prev) =>
          prev ? { ...prev, authToken: authToken.trim() } : null,
        );
        fetchServerTools(server.id);
      }
    } catch (err) {
      console.error('Error updating auth token:', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to update auth token',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const refreshServerStatus = () => {
    if (server?.isEnabled) {
      setServer((prev) => (prev ? { ...prev, status: 'loading' } : null));
      fetchServerTools(server.id);
    }
  };

  const getStatusColor = (status: MCPServerWithStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disabled':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      case 'auth_required':
        return 'bg-orange-500';
      case 'loading':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: MCPServerWithStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disabled':
        return 'Disabled';
      case 'error':
        return 'Error';
      case 'auth_required':
        return 'Auth Required';
      case 'loading':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {server && (
                <>
                  <div
                    className={`size-3 rounded-full ${getStatusColor(server.status)}`}
                  />
                  {server.name}
                  <Badge
                    variant={
                      server.status === 'connected'
                        ? 'default'
                        : server.status === 'auth_required'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className={`text-xs ${server.status === 'auth_required' ? 'cursor-pointer hover:bg-destructive/80' : ''}`}
                    onClick={
                      server.status === 'auth_required'
                        ? () => {
                            setAuthRequiredServer(server);
                            setAuthToken(server.authToken || '');
                          }
                        : undefined
                    }
                  >
                    {getStatusText(server.status)}
                  </Badge>
                  {server.status === 'connected' && server.tools && (
                    <Badge variant="outline" className="text-xs">
                      {server.tools.length} tool
                      {server.tools.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              MCP Server Configuration and Status
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-4 py-6">
              <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <Server className="size-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-red-700 dark:text-red-400">
                Error Loading Server
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : server ? (
            <div className="space-y-6">
              {/* Server Details */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    URL
                  </h4>
                  <p className="font-mono text-sm break-all bg-muted/30 p-2 rounded">
                    {server.url}
                  </p>
                </div>

                {server.description && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      DESCRIPTION
                    </h4>
                    <p className="text-sm">{server.description}</p>
                  </div>
                )}

                {server.authToken && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      AUTHENTICATION
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ Bearer token configured
                    </p>
                  </div>
                )}

                {server.lastChecked && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">
                      LAST CHECKED
                    </h4>
                    <p className="text-sm">
                      {server.lastChecked.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 py-3 border-t border-border/50">
                {server.isEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshServerStatus}
                    disabled={loadingTools}
                    className="text-xs"
                  >
                    {loadingTools ? '⟳ Checking...' : '↻ Refresh'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(server)}
                  className="text-xs"
                >
                  <Edit className="size-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteServer(server)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="size-3 mr-1" />
                  Delete
                </Button>
              </div>

              {/* Error Message */}
              {server.error && (
                <div
                  className={`p-3 border rounded text-sm ${
                    server.status === 'auth_required'
                      ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  }`}
                >
                  {server.status === 'auth_required'
                    ? 'Authentication required. Click "Auth Required" badge to update token.'
                    : server.error}
                </div>
              )}

              {/* Tools Section */}
              {server.tools && server.tools.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 py-2 border-t border-border/50">
                    <Wrench className="size-4 text-muted-foreground" />
                    <h3 className="font-medium text-base">
                      Tools ({server.tools.length})
                    </h3>
                  </div>

                  <div className="grid gap-3 max-h-60 overflow-y-auto">
                    {server.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="border border-border/30 rounded-lg p-4 bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-3">
                          <div>
                            <h5 className="font-mono text-sm font-semibold text-foreground">
                              {tool.name}
                            </h5>
                            {tool.description && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {tool.description}
                              </p>
                            )}
                          </div>
                          {tool.inputSchema && (
                            <details className="text-sm">
                              <summary className="text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                                View Input Schema
                              </summary>
                              <pre className="mt-3 p-3 bg-muted rounded-md text-xs overflow-auto font-mono max-h-32 border">
                                {JSON.stringify(tool.inputSchema, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingServer}
        onOpenChange={(open) => !open && setEditingServer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit MCP Server</DialogTitle>
            <DialogDescription>
              Update the configuration for this MCP server.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., File Tools"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={formData.url}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="http://localhost:8000/mcp"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-authToken">Auth Token (Optional)</Label>
              <Input
                id="edit-authToken"
                type="password"
                value={formData.authToken}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    authToken: e.target.value,
                  }))
                }
                placeholder="Bearer token for authentication"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what this server provides..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingServer(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditServer} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Required Dialog */}
      <Dialog
        open={!!authRequiredServer}
        onOpenChange={(open) => !open && setAuthRequiredServer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>
              The server &ldquo;{authRequiredServer?.name}&rdquo; requires
              authentication. Please provide a valid auth token.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="auth-token">Auth Token</Label>
              <Input
                id="auth-token"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Bearer token for authentication"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This token will be saved and used for future connections to this
                server.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAuthRequiredServer(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateAuthToken} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
