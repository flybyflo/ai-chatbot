import {
  FileBox,
  MessageCircle,
  RefreshCw,
  type LucideIcon,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const eventTypeConfig: Record<
  string,
  { icon: LucideIcon; className: string; label: string }
> = {
  message: {
    icon: MessageCircle,
    className: "text-blue-500",
    label: "Message",
  },
  task: {
    icon: ListTodo,
    className: "text-purple-500",
    label: "Task",
  },
  "status-update": {
    icon: RefreshCw,
    className: "text-orange-500",
    label: "Status Update",
  },
  "artifact-update": {
    icon: FileBox,
    className: "text-green-500",
    label: "Artifact Update",
  },
};

export function A2AEventTypeIcon({
  type,
  className,
  showLabel = false,
}: {
  type: string;
  className?: string;
  showLabel?: boolean;
}) {
  const config = eventTypeConfig[type] || {
    icon: MessageCircle,
    className: "text-muted-foreground",
    label: type,
  };
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Icon className={cn("size-4", config.className)} />
      {showLabel && (
        <span className="font-medium text-sm">{config.label}</span>
      )}
    </div>
  );
}

export { eventTypeConfig };
