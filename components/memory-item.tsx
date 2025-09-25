"use client";

import { useState } from "react";
import { Edit, MoreVertical, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UserMemory } from "@/hooks/use-memories";
import { cn } from "@/lib/utils";

type MemoryItemProps = {
  memory: UserMemory;
  onUpdate: (data: { id: string; title?: string; content?: string; isActive?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating?: boolean;
};

export function MemoryItem({ memory, onUpdate, onDelete, isUpdating = false }: MemoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onUpdate({
        id: memory.id,
        title: title.trim(),
        content: content.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update memory:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(memory.title);
    setContent(memory.content);
    setIsEditing(false);
  };

  const handleToggleActive = async () => {
    try {
      await onUpdate({
        id: memory.id,
        isActive: !memory.isActive,
      });
    } catch (error) {
      console.error("Failed to toggle memory:", error);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this memory?")) {
      try {
        await onDelete(memory.id);
      } catch (error) {
        console.error("Failed to delete memory:", error);
      }
    }
  };

  return (
    <Card className={cn(
      "transition-opacity",
      !memory.isActive && "opacity-60"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {isEditing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Memory title..."
            className="font-semibold"
          />
        ) : (
          <h3 className="font-semibold text-sm">{memory.title}</h3>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleActive}>
              {memory.isActive ? (
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
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Memory content..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!title.trim() || isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{memory.content}</p>
            {!memory.isActive && (
              <p className="mt-2 text-muted-foreground text-xs italic">
                This memory is disabled and won't be used in conversations.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}