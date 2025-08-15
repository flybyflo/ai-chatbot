'use client';

import { useState, useCallback } from 'react';
import { useMCPServers } from '@/hooks/use-mcp-servers';
import { Card, CardContent, CardHeader, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { ChevronRight, Server, } from 'lucide-react';
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


interface MCPServersContentProps {
  onServerSelect?: (serverId: string) => void;
}

function MCPServersContent({ onServerSelect }: MCPServersContentProps) {
  const { servers, isInitialLoading, error, loadingTools, fetchServerTools, refetch } = useMCPServers();
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    url: '',
    authToken: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [authRequiredServer, setAuthRequiredServer] = useState<MCPServer | null>(null);
  const [authToken, setAuthToken] = useState('');

  // Handle auth required servers
  const handleAuthRequired = useCallback((server: MCPServerWithStatus) => {
    setAuthRequiredServer(server as MCPServer);
    setAuthToken(server.authToken || '');
  }, []);


  const resetForm = () => {
    setFormData({ name: '', url: '', authToken: '', description: '' });
    setEditingServer(null);
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
      resetForm();
      refetch();
    } catch (err) {
      console.error('Error updating MCP server:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update server');
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
      refetch();
    } catch (err) {
      console.error('Error deleting MCP server:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  const openEditDialog = (server: MCPServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      url: server.url,
      authToken: server.authToken || '',
      description: server.description || '',
    });
  };

  const selectServer = (server: MCPServerWithStatus) => {
    onServerSelect?.(server.id);
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


  const handleUpdateAuthToken = useCallback(async () => {
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
      
      // Refresh the server status immediately
      refetch();
      
    } catch (err) {
      console.error('Error updating auth token:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update auth token');
    } finally {
      setSubmitting(false);
    }
  }, [authRequiredServer, authToken, refetch]);

  // The loading state is now handled by the parent component
  // This component will only render when data is available

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="size-6" />
            MCP Servers
          </h1>
          <p className="text-muted-foreground">
            Model Context Protocol servers configuration
          </p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Server className="size-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-red-700 dark:text-red-400">Error Loading MCP Servers</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {servers.map((server) => (
          <Card 
            key={server.id} 
            className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => selectServer(server)}
          >
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`size-2 rounded-full ${getStatusColor(server.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{server.name}</h3>
                      <Badge 
                        variant={
                          server.status === 'connected' ? 'default' : 
                          server.status === 'auth_required' ? 'destructive' : 
                          'secondary'
                        } 
                        className="text-xs h-5"
                      >
                        {getStatusText(server.status)}
                      </Badge>
                      {server.status === 'connected' && server.tools && (
                        <Badge variant="outline" className="text-xs h-5">
                          {server.tools.length} tool{server.tools.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate">{server.url}</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              {server.error && server.status === 'auth_required' && (
                <div className="mt-2 p-1.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-400">
                  Authentication required
                </div>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {servers.length === 0 && !isInitialLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Server className="size-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No MCP Servers Configured</h3>
            <p className="text-muted-foreground mb-4">
              Add MCP servers to extend your AI capabilities with external tools.
            </p>
            <p className="text-sm text-muted-foreground">
              Use the &ldquo;Add&rdquo; button in the header to create your first server.
            </p>
          </CardContent>
        </Card>
      )}


      {/* Edit Dialog */}
      <Dialog open={!!editingServer} onOpenChange={(open) => !open && setEditingServer(null)}>
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
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., File Tools"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="http://localhost:8000/mcp"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-authToken">Auth Token (Optional)</Label>
              <Input
                id="edit-authToken"
                type="password"
                value={formData.authToken}
                onChange={(e) => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="Bearer token for authentication"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
      <Dialog open={!!authRequiredServer} onOpenChange={(open) => !open && setAuthRequiredServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>
              The server &ldquo;{authRequiredServer?.name}&rdquo; requires authentication. Please provide a valid auth token.
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
                This token will be saved and used for future connections to this server.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthRequiredServer(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAuthToken} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MCPServers({ onServerSelect }: MCPServersContentProps) {
  return <MCPServersContent onServerSelect={onServerSelect} />;
}