"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BentoA2AServerCard } from "@/components/ui/bento-a2a-grid";
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
import { useA2AServers } from "@/hooks/use-a2a-servers";

export function A2AServerManager() {
  const {
    a2aServers,
    isLoading,
    hasCached,
    createA2AServer,
    updateA2AServer,
    deleteA2AServer,
    testA2AServer,
    isCreating,
  } = useA2AServers();
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await createA2AServer({
        name: newName.trim(),
        cardUrl: newUrl.trim(),
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewUrl("");
      setNewDescription("");
      setIsDialogOpen(false);
      toast.success("A2A server created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create A2A server"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: {
    id: string;
    name?: string;
    cardUrl?: string;
    description?: string;
    isActive?: boolean;
  }) => {
    try {
      await updateA2AServer(data);
      toast.success("A2A server updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update A2A server"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteA2AServer(id);
      toast.success("A2A server deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete A2A server"
      );
    }
  };

  const handleTest = async (id: string) => {
    try {
      const server = a2aServers.find((s) => s.id === id);
      if (!server) {
        return;
      }
      await testA2AServer({
        id: server.id,
        cardUrl: server.cardUrl,
        headers: server.headers,
      });
      toast.success("A2A server test completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to test A2A server"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">A2A Servers</h1>
        <p className="text-muted-foreground">
          Configure A2A agent card endpoints.
        </p>
      </div>
      <div className="grid w-full auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {a2aServers.map((server) => (
          <BentoA2AServerCard
            key={server.id}
            onDelete={handleDelete}
            onTest={handleTest}
            onUpdate={handleUpdate}
            server={server}
          />
        ))}

        {/* Loading State */}
        {isLoading && !hasCached && a2aServers.length === 0 && (
          <div className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20" />
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

        <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="group relative col-span-1 flex h-[18rem] transform-gpu flex-col justify-center overflow-hidden rounded-xl bg-background transition-all duration-300 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
              type="button"
              variant="ghost"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20" />
              <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />
              <div className="flex h-full items-center justify-center p-4">
                <div className="text-center">
                  <Plus className="mx-auto mb-4 h-12 w-12 text-neutral-400 transition-colors duration-300 group-hover:text-neutral-600" />
                  <h3 className="font-semibold text-lg text-neutral-700 transition-colors duration-300 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100">
                    Add A2A Server
                  </h3>
                </div>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New A2A Server</DialogTitle>
              <DialogDescription>
                Configure an A2A agent (Agent Card URL) for your assistant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Server name (e.g., 'Movie Agent')"
                value={newName}
              />
              <Input
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Agent Card URL"
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
                  className="bg-orange-600 text-white hover:bg-orange-700"
                  disabled={
                    !newName.trim() || !newUrl.trim() || isSaving || isCreating
                  }
                  onClick={handleCreate}
                >
                  {isSaving || isCreating ? (
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
