import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const stateConfig = {
  active: {
    label: "Active",
    icon: Loader2,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    iconClassName: "animate-spin",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    iconClassName: "",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-600 border-green-500/20",
    iconClassName: "",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    iconClassName: "",
  },
  error: {
    label: "Error",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    iconClassName: "",
  },
  pending: {
    label: "Pending",
    icon: Circle,
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    iconClassName: "",
  },
  unknown: {
    label: "Unknown",
    icon: Circle,
    className: "bg-muted text-muted-foreground border-border",
    iconClassName: "",
  },
} as const;

type TaskState = keyof typeof stateConfig;

export function A2ATaskStateBadge({
  state,
  className,
}: {
  state?: string;
  className?: string;
}) {
  const normalizedState = (state?.toLowerCase() || "unknown") as TaskState;
  const config =
    stateConfig[normalizedState] || stateConfig.unknown;
  const Icon = config.icon;

  return (
    <Badge
      className={cn("flex items-center gap-1 font-medium", config.className, className)}
      variant="outline"
    >
      <Icon className={cn("size-3", config.iconClassName)} />
      {config.label}
    </Badge>
  );
}
