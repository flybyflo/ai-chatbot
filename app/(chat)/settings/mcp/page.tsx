'use client';

import { MCPServerDataTable, type mcpServerSchema } from '@/components/mcp-server-data-table';
import { useMCPServers, type MCPServerWithStatus } from '@/hooks/use-mcp-servers';
import { Suspense, useState } from 'react';
import type { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { SettingsHeader } from '@/components/settings-header';

function MCPServersContent() {
  const { servers, isInitialLoading, refetch, forceRefresh } = useMCPServers();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    authToken: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Convert servers to match the schema format
  const dataTableServers: z.infer<typeof mcpServerSchema>[] = servers.map(server => {
    return {
      id: server.id,
      name: server.name,
      url: server.url,
      status: server.status || 'disabled',
      description: server.description,
      authToken: server.authToken,
      tools: server.tools?.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      isEnabled: server.isEnabled,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  });

  const handleAddServer = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          url: formData.url.trim(),
          authToken: formData.authToken.trim() || undefined,
          description: formData.description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create server');
      }

      toast.success('MCP server added successfully');
      setIsAddDialogOpen(false);
      setFormData({ name: '', url: '', authToken: '', description: '' });
      refetch();
    } catch (err) {
      console.error('Error adding MCP server:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add server');
    } finally {
      setSubmitting(false);
    }
  };

  // Show data table immediately if we have any servers (including cached)
  // Only show loading skeleton if we have no data at all

  return (
    <>
      <MCPServerDataTable 
        data={dataTableServers}
        onServerAdd={() => setIsAddDialogOpen(true)}
        onServerUpdate={(server) => {
          // Handle server update
          console.log('Update server:', server);
        }}
        onServerDelete={(serverId) => {
          // Handle server delete
          console.log('Delete server:', serverId);
        }}
      />

      {/* Add Server Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Add a new Model Context Protocol server to extend your AI capabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., File Tools"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="http://localhost:8000/mcp"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="authToken">Auth Token (Optional)</Label>
              <Input
                id="authToken"
                type="password"
                value={formData.authToken}
                onChange={(e) => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="Bearer token for authentication"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this server provides..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddServer} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MCPServersLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <h2 className="text-lg font-semibold">MCP Servers</h2>
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted p-4">
            <div className="flex gap-4">
              {['Drag', 'Select', 'Name', 'URL', 'Status', 'Tools', 'Enabled', 'Actions'].map((header) => (
                <div key={header} className="h-4 bg-muted-foreground/20 rounded flex-1" />
              ))}
            </div>
          </div>
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex gap-4">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={`skeleton-row-${i}-col-${j}`} className="h-4 bg-muted rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MCPSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <SettingsHeader title="MCP Servers" />
      
      <div className="flex-1 overflow-auto">
        <div className="py-6">
          <MCPServersContent />
        </div>
      </div>
    </div>
  );
}