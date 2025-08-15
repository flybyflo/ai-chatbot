'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, TestTube, Trash2, AlertCircle, CheckCircle, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SettingsHeader } from '@/components/settings-header';
import { MCPToolsDataTable } from '@/components/mcp-tools-data-table';
import { useMCPServers, type MCPServerWithStatus } from '@/hooks/use-mcp-servers';

export default function MCPServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [serverId, setServerId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { getServerById, fetchServerTools, refetch, forceRefresh } = useMCPServers();
  
  // Get server from centralized store
  const server = serverId ? getServerById(serverId) : null;
  const loading = !server && serverId !== '';

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    authToken: '',
    isEnabled: false,
  });

  // Unwrap params promise
  useEffect(() => {
    params.then((resolvedParams) => {
      setServerId(resolvedParams.id);
    });
  }, [params]);

  // Update form data when server changes
  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        url: server.url,
        description: server.description || '',
        authToken: server.authToken || '',
        isEnabled: server.isEnabled,
      });
      
      // If server is enabled but has no tools, fetch them
      if (server.isEnabled && (!server.tools || server.tools.length === 0)) {
        fetchServerTools(server.id).catch(console.error);
      }
    } else if (serverId && !server) {
      // Server not found in cache, force refresh to get latest data
      const timer = setTimeout(() => {
        forceRefresh();
        // If still not found after refresh, redirect to main page
        setTimeout(() => {
          if (!getServerById(serverId)) {
            toast.error('Server not found');
            router.push('/settings/mcp');
          }
        }, 2000);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [server, serverId, forceRefresh, getServerById, router, fetchServerTools]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/mcp-servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          ...formData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update server');
      }

      toast.success('Server updated successfully');
      refetch(); // Update the centralized cache
      router.push('/settings/mcp');
    } catch (error) {
      console.error('Error saving server:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save server');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverId) return;
    
    setTesting(true);
    try {
      await fetchServerTools(serverId);
      toast.success('Connection test successful!');
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${server?.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp-servers?id=${serverId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete server');
      }

      toast.success('Server deleted successfully');
      refetch(); // Update the centralized cache
      router.push('/settings/mcp');
    } catch (error) {
      console.error('Error deleting server:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete server');
    }
  };

  const getStatusIcon = () => {
    switch (server?.status) {
      case 'connected':
        return <CheckCircle className="size-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="size-4 text-red-500" />;
      case 'auth_required':
        return <AlertCircle className="size-4 text-orange-500" />;
      default:
        return <Server className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (server?.status) {
      case 'connected':
        return 'Connected';
      case 'disabled':
        return 'Disabled';
      case 'error':
        return 'Error';
      case 'auth_required':
        return 'Auth Required';
      case 'loading':
        return 'Loading...';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <SettingsHeader 
          title="Loading..." 
          breadcrumbs={[{ label: 'MCP Servers', href: '/settings/mcp' }]} 
        />
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="space-y-6">
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-full bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!server) return null;

  return (
    <div className="flex flex-col h-full">
      <SettingsHeader 
        title={server.name} 
        breadcrumbs={[{ label: 'MCP Servers', href: '/settings/mcp' }]} 
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Server Configuration */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Server Configuration</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Server Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., File Tools"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enabled">Status</Label>
                    <div className="flex items-center pt-2">
                      <Checkbox
                        id="enabled"
                        checked={formData.isEnabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: !!checked }))}
                      />
                      <Label htmlFor="enabled" className="ml-2 text-sm">
                        Enable this server
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Server URL</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="http://localhost:8000/mcp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-token">Auth Token (Optional)</Label>
                  <Input
                    id="auth-token"
                    type="password"
                    value={formData.authToken}
                    onChange={(e) => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                    placeholder="Bearer token for authentication"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this server provides..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <div className="space-y-4">
            <MCPToolsDataTable data={server.tools || []} />
          </div>

          {/* Server Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Server Information</h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Created</div>
                <div>{new Date(server.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Last Updated</div>
                <div>{new Date(server.updatedAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                <TestTube className="size-4 mr-2" />
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button variant="outline" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="size-4 mr-2" />
                Delete
              </Button>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}