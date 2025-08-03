'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MCPServers } from './mcp-servers';
import { MCPServerDetailDialog } from './mcp-server-detail-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface MCPServerFormData {
  name: string;
  url: string;
  authToken: string;
  description: string;
}

export function MCPServersWithDialog() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    url: '',
    authToken: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // For refreshing the server list

  const handleServerSelect = (serverId: string) => {
    setSelectedServerId(serverId);
    setIsDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedServerId(null);
  };

  const handleServerDeleted = () => {
    // Refresh the server list when a server is deleted
    setRefreshKey(prev => prev + 1);
  };

  const resetForm = () => {
    setFormData({ name: '', url: '', authToken: '', description: '' });
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

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
      resetForm();
      
      // Refresh the server list
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Error adding MCP server:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">MCP Servers</h3>
        <Button
          size="sm"
          onClick={openAddDialog}
          className="h-6 px-2 text-xs"
        >
          <Plus className="size-3 mr-1" />
          Add
        </Button>
      </div>

      <MCPServers key={refreshKey} onServerSelect={handleServerSelect} />

      {/* Server Detail Dialog */}
      <MCPServerDetailDialog
        serverId={selectedServerId}
        isOpen={isDetailDialogOpen}
        onClose={handleCloseDetailDialog}
        onServerDeleted={handleServerDeleted}
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
    </div>
  );
}