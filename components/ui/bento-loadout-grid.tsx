"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserLoadout } from "@/hooks/use-loadouts";

interface BentoLoadoutGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoLoadoutCardProps {
  loadout: UserLoadout;
  onUpdate: (data: {
    id: string;
    name?: string;
    description?: string;
    color?: string;
    tags?: string[];
    isDefault?: boolean;
    selectedTools?: string[];
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  className?: string;
}

const BentoLoadoutGrid = ({
  children,
  className,
  ...props
}: BentoLoadoutGridProps) => {
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

const BadgePill = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px]",
      "border border-border/40 bg-background/60 text-foreground/80",
      className
    )}
  >
    {children}
  </span>
);

const BentoLoadoutCard = ({
  loadout,
  onUpdate,
  onDelete,
  className,
}: BentoLoadoutCardProps) => {
  const totalCount = loadout.selectedTools?.length || 0;

  const handleSetDefault = async () => {
    await onUpdate({ id: loadout.id, isDefault: true });
  };

  const handleDelete = async () => {
    await onDelete(loadout.id);
  };

  return (
    <div
      className={cn(
        "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl",
        // light styles
        "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
        className
      )}
    >
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-100 dark:from-purple-950/20 dark:to-blue-900/20" />

      <div className="relative z-10 flex h-full flex-col p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="size-4 shrink-0 rounded"
              style={{ backgroundColor: loadout.color || "#8b5cf6" }}
            />
            <Link
              className="truncate font-semibold text-base text-foreground hover:underline"
              href={`/settings/loadouts/${loadout.id}`}
            >
              {loadout.name}
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            {loadout.isDefault && (
              <>
                <Star className="h-4 w-4 text-yellow-500" />
                <BadgePill>Default</BadgePill>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mb-4 space-y-2">
          {loadout.description && (
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {loadout.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {loadout.tags?.map((tag) => (
              <BadgePill key={tag}>{tag}</BadgePill>
            ))}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span>
              {totalCount} {totalCount === 1 ? "tool" : "tools"}
            </span>
          </div>
        </div>

        {/* Actions — always visible, compact outline buttons */}
        <div className="mt-auto flex w-full gap-2">
          <Button
            className="flex-1"
            disabled={loadout.isDefault}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSetDefault();
            }}
            size="sm"
            variant="outline"
          >
            {loadout.isDefault ? "Default" : "Set Default"}
          </Button>
          <Button
            className="flex-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete();
            }}
            size="sm"
            variant="outline"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export { BentoLoadoutCard, BentoLoadoutGrid };
