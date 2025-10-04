import {
  FileBox,
  ListTodo,
  type LucideIcon,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { A2A_EVENT_TYPES, type A2AEventType } from "@/lib/enums";
import { cn } from "@/lib/utils";

const eventTypeConfig: Record<
  A2AEventType,
  { icon: LucideIcon; className: string; label: string }
> = {
  [A2A_EVENT_TYPES.MESSAGE]: {
    icon: MessageCircle,
    className: "text-blue-500",
    label: "Message",
  },
  [A2A_EVENT_TYPES.TASK]: {
    icon: ListTodo,
    className: "text-purple-500",
    label: "Task",
  },
  [A2A_EVENT_TYPES.STATUS_UPDATE]: {
    icon: RefreshCw,
    className: "text-orange-500",
    label: "Status Update",
  },
  [A2A_EVENT_TYPES.ARTIFACT_UPDATE]: {
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
  const config = eventTypeConfig[type as A2AEventType] || {
    icon: MessageCircle,
    className: "text-muted-foreground",
    label: type,
  };
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Icon className={cn("size-4", config.className)} />
      {showLabel && <span className="font-medium text-sm">{config.label}</span>}
    </div>
  );
}

export { eventTypeConfig };
