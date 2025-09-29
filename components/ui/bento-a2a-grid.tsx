"use client";
export const dynamic = "force-dynamic";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { UserA2AServer } from "@/hooks/use-a2a-servers";
import { cn } from "@/lib/utils";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BentoA2AServerGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

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

const BentoA2AServerGrid = ({
  children,
  className,
  ...props
}: BentoA2AServerGridProps) => {
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

const BentoA2AServerCard = ({
  server,
  onUpdate,
  onDelete,
  onTest,
  className,
  ...props
}: BentoA2AServerCardProps) => {
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
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (server.lastConnectionStatus === "connected") {
      return "Connected";
    }
    if (server.lastConnectionStatus === "failed") {
      return "Failed";
    }
    if (server.lastConnectionStatus === "testing") {
      return "Testing...";
    }
    return "Not tested";
  };

  const getBackground = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20" />
  );

  const isUuid = UUID_REGEX.test(server.id);

  return (
    <div
      className={cn(
        "group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-xl",
        "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        "transform-gpu dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
        !server.isActive && "opacity-60",
        className
      )}
      key={server.id}
      {...props}
    >
      {isUuid ? (
        <Link
          aria-label={`View details for ${server.name}`}
          className="absolute inset-0 z-10"
          href={`/settings/a2a-servers/${server.id}`}
        />
      ) : null}
      <div>{getBackground()}</div>
      <div className="p-4">
        <div className="lg:group-hover:-translate-y-10 pointer-events-none z-20 flex transform-gpu flex-col gap-1 transition-all duration-300">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-lg text-neutral-700 dark:text-neutral-300">
              {server.name}
            </h3>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-neutral-500 text-xs">
                {getStatusText()}
              </span>
            </div>
          </div>
          <div className="mb-4 space-y-2">
            <p className="break-all text-neutral-600 text-sm dark:text-neutral-400">
              {server.cardUrl}
            </p>
            {server.description ? (
              <p className="line-clamp-2 text-neutral-500 text-xs">
                {server.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none relative z-30 flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden">
          <Button
            className="pointer-events-auto flex-1 bg-orange-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-orange-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTest(server.id);
            }}
            size="sm"
          >
            Test
          </Button>
          <Button
            className="pointer-events-auto flex-1 bg-orange-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-orange-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpdate({ id: server.id, isActive: !server.isActive });
            }}
            size="sm"
          >
            {server.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 z-30 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
        <div className="flex w-full gap-2">
          <Button
            className="pointer-events-auto flex-1 bg-orange-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-orange-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTest(server.id);
            }}
            size="sm"
          >
            Test
          </Button>
          <Button
            className="pointer-events-auto flex-1 bg-orange-600 text-white text-xs transition-all duration-200 hover:scale-105 hover:bg-orange-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpdate({ id: server.id, isActive: !server.isActive });
            }}
            size="sm"
          >
            {server.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      {isUuid ? null : (
        <div className="absolute inset-0 z-20 flex items-end justify-end p-2">
          <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            Saving…
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />
    </div>
  );
};

export { BentoA2AServerCard, BentoA2AServerGrid };
