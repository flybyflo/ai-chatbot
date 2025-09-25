"use client";

import { useState } from "react";
import { Plus, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMemories } from "@/hooks/use-memories";
import { MemoryItem } from "./memory-item";
import { toast } from "./toast";

export function MemoryManager() {
  const { memories, isLoading, createMemory, updateMemory, deleteMemory } = useMemories();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    setIsSaving(true);
    try {
      await createMemory({
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setNewTitle("");
      setNewContent("");
      setIsCreating(false);
      toast({
        type: "success",
        description: "Memory created successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description: error instanceof Error ? error.message : "Failed to create memory",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: { id: string; title?: string; content?: string; isActive?: boolean }) => {
    try {
      await updateMemory(data);
      toast({
        type: "success",
        description: "Memory updated successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description: error instanceof Error ? error.message : "Failed to update memory",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      toast({
        type: "success",
        description: "Memory deleted successfully",
      });
    } catch (error) {
      toast({
        type: "error",
        description: error instanceof Error ? error.message : "Failed to delete memory",
      });
    }
  };

  const activeMemories = memories.filter(memory => memory.isActive);
  const inactiveMemories = memories.filter(memory => !memory.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5" />
        <h1 className="font-semibold text-xl">Memory Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About Memories</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p>
            Memories help the AI assistant remember important information about you,
            your preferences, and context that should guide future conversations.
            Only active memories will be used to personalize responses.
          </p>
        </CardContent>
      </Card>

      {/* Create New Memory */}
      {isCreating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create New Memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Memory title (e.g., 'Favorite Programming Language')"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Memory content (e.g., 'Prefers TypeScript and React for web development')"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isSaving}
              >
                {isSaving ? "Creating..." : "Create Memory"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsCreating(true)} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add New Memory
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground text-sm">Loading memories...</div>
        </div>
      ) : (
        <>
          {/* Active Memories */}
          {activeMemories.length > 0 && (
            <div>
              <h2 className="mb-3 font-medium text-sm text-foreground">
                Active Memories ({activeMemories.length})
              </h2>
              <div className="space-y-3">
                {activeMemories.map((memory) => (
                  <MemoryItem
                    key={memory.id}
                    memory={memory}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Memories */}
          {inactiveMemories.length > 0 && (
            <>
              {activeMemories.length > 0 && <Separator />}
              <div>
                <h2 className="mb-3 font-medium text-sm text-muted-foreground">
                  Disabled Memories ({inactiveMemories.length})
                </h2>
                <div className="space-y-3">
                  {inactiveMemories.map((memory) => (
                    <MemoryItem
                      key={memory.id}
                      memory={memory}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {memories.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-medium">No memories yet</h3>
                <p className="mb-4 text-muted-foreground text-sm">
                  Create your first memory to help the AI assistant remember important information about you.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Memory
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}