"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BentoServerGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoServerCardProps extends ComponentPropsWithoutRef<"div"> {
  server: {
    id: string;
    name: string;
    url?: string;
    cardUrl?: string;
    description?: string | null;
    isActive: boolean;
    lastConnectionStatus?: string | null;
    toolCount?: number | null;
  };
  onUpdate: (data: {
    id: string;
    name?: string;
    url?: string;
    cardUrl?: string;
    description?: string;
    authMode?: "convex" | "manual";
    accessToken?: string | null;
    isActive?: boolean;
  }) => void;
  onDelete: (id: string) => void; // kept for API parity (unused here)
  onTest: (id: string) => void;
  className?: string;
  detailsHref?: string;
  gradientClasses: string;
  additionalInfo?: ReactNode;
}

const BentoServerGrid = ({
  children,
  className,
  ...props
}: BentoServerGridProps) => {
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

const CodeChip = ({ children }: { children: ReactNode }) => (
  <code className="inline break-all rounded border border-border/30 bg-background/60 px-1.5 py-0.5 font-mono text-[11px]">
    {children}
  </code>
);

const BentoServerCard = ({
  server,
  onUpdate,
  onDelete: _onDelete, // unused here
  onTest,
  className,
  detailsHref,
  gradientClasses,
  additionalInfo,
  ...props
}: BentoServerCardProps) => {
  const getStatusIcon = () => {
    if (server.lastConnectionStatus === "connected") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (server.lastConnectionStatus === "failed") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (server.lastConnectionStatus === "testing") {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (server.lastConnectionStatus === "connected") {
      return "Connected";
    }
    if (server.lastConnectionStatus === "failed") {
      return "Failed";
    }
    if (server.lastConnectionStatus === "testing") {
      return "Testing…";
    }
    return "Not tested";
  };

  const displayUrl = server.url || server.cardUrl || "";

  return (
    <div
      className={cn(
        "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl",
        // light styles
        "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
        !server.isActive && "opacity-60",
        className
      )}
      {...props}
    >
      {/* keep gradient background, but no hover effects */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          gradientClasses
        )}
      />

      <div className="relative z-10 flex h-full flex-col p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          {detailsHref ? (
            <Link
              className="truncate font-semibold text-base text-foreground hover:underline"
              href={detailsHref}
            >
              {server.name}
            </Link>
          ) : (
            <h3 className="truncate font-semibold text-base text-foreground">
              {server.name}
            </h3>
          )}
          <div className="flex items-center gap-1.5">
            {getStatusIcon()}
            <BadgePill>{getStatusText()}</BadgePill>
          </div>
        </div>

        {/* Body */}
        <div className="mb-4 space-y-2">
          {displayUrl && (
            <p className="text-sm">
              <CodeChip>{displayUrl}</CodeChip>
            </p>
          )}
          {server.description && (
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {server.description}
            </p>
          )}
          {additionalInfo}
        </div>

        {/* Actions — always visible, compact outline buttons, no hover animation */}
        <div className="mt-auto flex w-full gap-2">
          <Button
            className="flex-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTest(server.id);
            }}
            size="sm"
            variant="outline"
          >
            Test
          </Button>
          <Button
            className="flex-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpdate({ id: server.id, isActive: !server.isActive });
            }}
            size="sm"
            variant="outline"
          >
            {server.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      {/* remove hover overlay/animation */}
      {/* (intentionally omitted) */}
    </div>
  );
};

export { BentoServerCard, BentoServerGrid };
