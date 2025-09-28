"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BentoMemoryCard } from "@/components/ui/bento-memory-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useMemories } from "@/hooks/use-memories";

export function MemoryManager() {
  const {
    memories,
    isLoading,
    createMemory,
    updateMemory,
    deleteMemory,
    isCreating: isCreatingMemory,
  } = useMemories();
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await createMemory({
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setNewTitle("");
      setNewContent("");
      toast.success("Memory created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create memory"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: {
    id: string;
    title?: string;
    content?: string;
    isActive?: boolean;
  }) => {
    try {
      await updateMemory(data);
      toast.success("Memory updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update memory"
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      toast.success("Memory deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete memory"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid w-full auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Memories */}
        {memories.map((memory) => (
          <BentoMemoryCard
            key={memory.id}
            memory={memory}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}

        {/* Add Memory Button */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="group relative col-span-1 flex transform-gpu flex-col justify-center overflow-hidden rounded-xl bg-background transition-all duration-300 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
              type="button"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-900/20" />
              <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />

              <div className="flex h-full items-center justify-center p-4">
                <div className="text-center">
                  <Plus className="mx-auto mb-4 h-12 w-12 text-neutral-400 transition-colors duration-300 group-hover:text-neutral-600" />
                  <h3 className="font-semibold text-lg text-neutral-700 transition-colors duration-300 group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-neutral-100">
                    Add Memory
                  </h3>
                </div>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Memory</DialogTitle>
              <DialogDescription>
                Create a new memory to help the AI assistant remember important
                information about you.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Memory title (e.g., 'Favorite Programming Language')"
                value={newTitle}
              />
              <Textarea
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Memory content (e.g., 'Prefers TypeScript and React for web development')"
                rows={3}
                value={newContent}
              />
              <div className="flex justify-end gap-2">
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!newTitle.trim() || isSaving || isCreatingMemory}
                  onClick={handleCreate}
                >
                  {isSaving || isCreatingMemory
                    ? "Creating..."
                    : "Create Memory"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading && memories.length === 0 && (
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
