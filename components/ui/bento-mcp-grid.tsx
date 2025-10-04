"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { UserMCPServer } from "@/hooks/use-mcp-servers";
import { BentoServerCard, BentoServerGrid } from "./bento-server-card";

interface BentoMCPServerCardProps extends ComponentPropsWithoutRef<"div"> {
  server: UserMCPServer;
  onUpdate: (data: {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    isActive?: boolean;
  }) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  className?: string;
}

const BentoMCPServerGrid = BentoServerGrid;

const BentoMCPServerCard = ({
  server,
  onUpdate,
  onDelete,
  onTest,
  className,
  ...props
}: BentoMCPServerCardProps) => {
  return (
    <BentoServerCard
      additionalInfo={
        server.toolCount !== undefined ? (
          <p className="text-neutral-500 text-xs">
            {server.toolCount} tools available
          </p>
        ) : null
      }
      className={className}
      detailsHref={`/settings/mcp-servers/${server.id}`}
      gradientClasses="from-green-50 to-emerald-100 dark:from-green-950/20 dark:to-emerald-900/20"
      onDelete={onDelete}
      onTest={onTest}
      onUpdate={onUpdate}
      server={server}
      {...props}
    />
  );
};

export { BentoMCPServerCard, BentoMCPServerGrid };
