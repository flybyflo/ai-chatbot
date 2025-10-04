"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BentoLoadoutCard } from "@/components/ui/bento-loadout-grid";
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
import { Textarea } from "@/components/ui/textarea";
import { useLoadouts } from "@/hooks/use-loadouts";

export function LoadoutManager() {
  const { loadouts, isLoading, createLoadout, updateLoadout, deleteLoadout } =
    useLoadouts();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Loadout name is required");
      return;
    }

    setIsSaving(true);
    try {
      await createLoadout({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setNewName("");
      setNewDescription("");
      setNewTags("");
      setIsDialogOpen(false);
      toast.success("Loadout created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create loadout"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: {
    id: string;
    name?: string;
    description?: string;
    color?: string;
    tags?: string[];
    isDefault?: boolean;
    selectedTools?: string[];
  }) => {
    try {
      await updateLoadout(data);
      toast.success("Loadout updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update loadout"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLoadout(id);
      toast.success("Loadout deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete loadout"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">Loadouts</h1>
        <p className="text-muted-foreground">
          Create and manage loadouts to quickly configure tools and agents.
        </p>
      </div>
      <div className="grid w-full auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Loadouts */}
        {loadouts.map((loadout) => (
          <BentoLoadoutCard
            key={loadout.id}
            loadout={loadout}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}

        {/* Loading State */}
        {isLoading && loadouts.length === 0 && (
          <div className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-100 dark:from-purple-950/20 dark:to-blue-900/20" />
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

        {/* Add Loadout Button */}
        <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="group relative col-span-1 flex h-[18rem] transform-gpu flex-col justify-center overflow-hidden rounded-xl bg-background transition-all duration-300 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
              type="button"
              variant="ghost"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-100 dark:from-purple-950/20 dark:to-blue-900/20" />
              <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />

              <div className="flex h-full items-center justify-center p-4">
                <div className="text-center">
                  <Plus className="mx-auto mb-4 h-12 w-12 text-neutral-400 transition-colors duration-300 group-hover:text-neutral-600" />
                  <h3 className="font-semibold text-lg text-neutral-700 transition-colors duration-300 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100">
                    Add Loadout
                  </h3>
                </div>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Loadout</DialogTitle>
              <DialogDescription>
                Create a new loadout to save your preferred tools and agents
                configuration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  autoComplete="off"
                  id="name"
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Loadout"
                  value={newName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe this loadout..."
                  rows={3}
                  value={newDescription}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
                <Input
                  autoComplete="off"
                  id="tags"
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="research, prod, dev"
                  value={newTags}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button disabled={isSaving || !newName} onClick={handleCreate}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Loadout"
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
