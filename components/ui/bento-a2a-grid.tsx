"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { UserA2AServer } from "@/hooks/use-a2a-servers";
import { BentoServerCard, BentoServerGrid } from "./bento-server-card";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BentoA2AServerCardProps extends ComponentPropsWithoutRef<"div"> {
  server: UserA2AServer;
  onUpdate: (data: {
    id: string;
    name?: string;
    cardUrl?: string;
    description?: string;
    isActive?: boolean;
  }) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  className?: string;
}

const BentoA2AServerGrid = BentoServerGrid;

const BentoA2AServerCard = ({
  server,
  onUpdate,
  onDelete,
  onTest,
  className,
  ...props
}: BentoA2AServerCardProps) => {
  const isUuid = UUID_REGEX.test(server.id);

  return (
    <BentoServerCard
      className={className}
      detailsHref={isUuid ? `/settings/a2a-servers/${server.id}` : undefined}
      gradientClasses="from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20"
      onDelete={onDelete}
      onTest={onTest}
      onUpdate={onUpdate}
      server={server}
      {...props}
    />
  );
};

export { BentoA2AServerCard, BentoA2AServerGrid };
