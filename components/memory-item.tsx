"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserMemory } from "@/hooks/use-memories";
import { cn } from "@/lib/utils";

type MemoryItemProps = {
  memory: UserMemory;
  onUpdate: (data: {
    id: string;
    title?: string;
    content?: string;
    isActive?: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (memory: UserMemory) => void;
  isUpdating?: boolean;
};

export function MemoryItem({
  memory,
  onUpdate,
  onDelete,
  onEdit,
}: MemoryItemProps) {
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
    <div
      className={cn(
        "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl",
        // light styles
        "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
        !memory.isActive && "opacity-60"
      )}
    >
      {/* keep gradient background, but no hover effects */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          "from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-900/20"
        )}
      />

      <div className="relative z-10 flex h-full flex-col p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-base text-foreground">
            {memory.title}
          </h3>
          <div className="flex items-center gap-1.5">
            {memory.isActive ? (
              <Eye className="h-4 w-4 text-green-500" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px]",
                "border border-border/40 bg-background/60 text-foreground/80"
              )}
            >
              {memory.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="mb-4 space-y-2">
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {memory.content}
          </p>
          {!memory.isActive && (
            <p className="text-muted-foreground text-xs italic">
              This memory is disabled and won't be used in conversations.
            </p>
          )}
        </div>

        {/* Actions — always visible, compact outline buttons, no hover animation */}
        <div className="mt-auto flex w-full gap-2">
          <Button
            className="flex-1"
            onClick={() => onEdit(memory)}
            size="sm"
            variant="outline"
          >
            Edit
          </Button>
          <Button
            className="flex-1"
            onClick={handleToggleActive}
            size="sm"
            variant="outline"
          >
            {memory.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            className="flex-1"
            onClick={handleDelete}
            size="sm"
            variant="outline"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* remove hover overlay/animation */}
      {/* (intentionally omitted) */}
    </div>
  );
}
