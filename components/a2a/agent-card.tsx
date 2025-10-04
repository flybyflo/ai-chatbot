import { ExternalLink, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { A2AAgentMetadata } from "@/lib/ai/a2a/types";
import { cn } from "@/lib/utils";

export function A2AAgentCard({
  agent,
  className,
}: {
  agent: A2AAgentMetadata;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-background p-4 transition-all hover:shadow-md",
        "[box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        "dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20" />
      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {agent.iconUrl ? (
              <img
                alt={agent.displayName}
                className="size-8 rounded"
                src={agent.iconUrl}
              />
            ) : (
              <Sparkles className="size-8 text-orange-500" />
            )}
            <div>
              <h3 className="font-semibold text-foreground">
                {agent.displayName}
              </h3>
              <p className="text-muted-foreground text-xs">{agent.id}</p>
            </div>
          </div>
          <Badge
            variant={agent.isReady ? "default" : "destructive"}
          >
            {agent.isReady ? "Ready" : "Error"}
          </Badge>
        </div>

        {agent.description && (
          <p className="line-clamp-2 text-muted-foreground text-sm">
            {agent.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {agent.supportsStreaming && (
            <Badge className="text-xs" variant="secondary">
              Streaming
            </Badge>
          )}
          {agent.skills && agent.skills.length > 0 && (
            <Badge className="text-xs" variant="secondary">
              {agent.skills.length} Skill{agent.skills.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {agent.defaultInputModes && agent.defaultInputModes.length > 0 && (
            <Badge className="text-xs" variant="outline">
              {agent.defaultInputModes.join(", ")}
            </Badge>
          )}
        </div>

        {agent.lastError && (
          <div className="rounded-md bg-red-500/10 p-2 text-red-600 text-xs">
            {agent.lastError}
          </div>
        )}

        <div className="flex gap-2">
          {agent.documentationUrl && (
            <Button asChild size="sm" variant="outline">
              <Link href={agent.documentationUrl} target="_blank">
                <FileText className="size-3" />
                Docs
                <ExternalLink className="size-3" />
              </Link>
            </Button>
          )}
          <Button asChild className="flex-1" size="sm" variant="outline">
            <Link href={`/settings/a2a-servers?agent=${agent.id}`}>
              View Server
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
