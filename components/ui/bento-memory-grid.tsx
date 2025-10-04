"use client";
export const dynamic = "force-dynamic";

import { Brain } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { UserMemory } from "@/hooks/use-memories";
import { cn } from "@/lib/utils";

interface BentoMemoryGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoMemoryCardProps extends ComponentPropsWithoutRef<"div"> {
  memory: UserMemory;
  onUpdate: (data: {
    id: string;
    title?: string;
    content?: string;
    isActive?: boolean;
  }) => void;
  onDelete: (id: string) => void;
  className?: string;
}

const BentoMemoryGrid = ({
  children,
  className,
  ...props
}: BentoMemoryGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const BentoMemoryCard = ({
  memory,
  onUpdate,
  onDelete,
  className,
  ...props
}: BentoMemoryCardProps) => {
  const getBackground = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-900/20" />
  );

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
        !memory.isActive && "opacity-60",
        className
      )}
      key={memory.id}
      {...props}
    >
      <div>{getBackground()}</div>
      <div className="p-4">
        <div className="lg:group-hover:-translate-y-10 pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-lg text-neutral-700 dark:text-neutral-300">
              {memory.title}
            </h3>
            <div className="flex items-center gap-1">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="text-neutral-500 text-xs">
                {memory.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <p className="line-clamp-3 text-neutral-600 text-sm dark:text-neutral-400">
              {memory.content}
            </p>
            <p className="text-neutral-500 text-xs">
              Created {new Date(memory.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden">
          <Button
            className="pointer-events-auto flex-1 bg-blue-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-blue-700"
            onClick={handleToggleActive}
            size="sm"
          >
            {memory.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            className="pointer-events-auto flex-1 bg-blue-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-blue-700"
            onClick={handleDelete}
            size="sm"
          >
            Delete
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex"
        )}
      >
        <div className="flex w-full gap-2">
          <Button
            className="pointer-events-auto flex-1 bg-blue-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-blue-700"
            onClick={handleToggleActive}
            size="sm"
          >
            {memory.isActive ? "Disable" : "Enable"}
          </Button>
          <Button
            className="pointer-events-auto flex-1 bg-blue-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-blue-700"
            onClick={handleDelete}
            size="sm"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />
    </div>
  );
};

export { BentoMemoryCard, BentoMemoryGrid };
