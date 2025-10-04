"use client";

import { Clock, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { A2AEventTypeIcon, A2AJsonViewer } from "@/components/a2a";
import { useDataStream } from "@/components/data-stream-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const eventTypeOptions = [
  { value: "all", label: "All Events" },
  { value: "message", label: "Messages" },
  { value: "task", label: "Tasks" },
  { value: "status-update", label: "Status Updates" },
  { value: "artifact-update", label: "Artifact Updates" },
];

export default function A2AEventsPage() {
  const { a2aEventLog, a2aRegistry } = useDataStream();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");

  const agentNames = useMemo(() => {
    if (!a2aRegistry) {
      return [];
    }
    return Object.values(a2aRegistry.agents)
      .map((a) => a.displayName)
      .sort();
  }, [a2aRegistry]);

  const events = useMemo(() => {
    if (!a2aEventLog) {
      return [];
    }
    return a2aEventLog;
  }, [a2aEventLog]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (filterAgent !== "all") {
      result = result.filter((event) => event.agentName === filterAgent);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((event) => {
        const searchText = JSON.stringify(event).toLowerCase();
        return searchText.includes(query);
      });
    }

    return result.reverse();
  }, [events, filterAgent, searchQuery]);

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(filteredEvents, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `a2a-events-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Events exported successfully");
    } catch {
      toast.error("Failed to export events");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">A2A Event Log</h1>
        <p className="text-muted-foreground">
          Debug A2A protocol events and interactions.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            value={searchQuery}
          />
        </div>
        <Select onValueChange={setFilterAgent} value={filterAgent}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agentNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleExport} variant="outline">
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="font-semibold text-foreground">No events found</p>
            <p className="text-muted-foreground text-sm">
              {events.length === 0
                ? "Events will appear here when A2A agents are active"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/30 p-3 text-muted-foreground text-sm">
            Showing {filteredEvents.length} event
            {filteredEvents.length !== 1 ? "s" : ""}
          </div>

          {filteredEvents.map((event, index) => {
            const eventType = event.messages
              ? "message"
              : event.statusUpdates && event.statusUpdates.length > 0
                ? "status-update"
                : event.artifacts && event.artifacts.length > 0
                  ? "artifact-update"
                  : event.tasks && event.tasks.length > 0
                    ? "task"
                    : "unknown";

            return (
              <div
                className="rounded-lg border bg-card p-4"
                key={`${event.agentToolId}-${event.timestamp}-${index}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <A2AEventTypeIcon showLabel type={eventType} />
                    <span className="font-medium text-orange-600 text-sm">
                      {event.agentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Clock className="size-3" />
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-foreground/70 text-xs">
                      Agent ID:
                    </span>{" "}
                    <span className="font-mono text-xs">{event.agentId}</span>
                  </div>
                  {event.contextId && (
                    <div>
                      <span className="font-medium text-foreground/70 text-xs">
                        Context:
                      </span>{" "}
                      <span className="font-mono text-xs">
                        {event.contextId}
                      </span>
                    </div>
                  )}
                  {event.primaryTaskId && (
                    <div>
                      <span className="font-medium text-foreground/70 text-xs">
                        Task:
                      </span>{" "}
                      <span className="font-mono text-xs">
                        {event.primaryTaskId}
                      </span>
                    </div>
                  )}
                </div>

                {event.responseText && (
                  <div className="mt-3">
                    <div className="mb-1 font-medium text-foreground/70 text-xs">
                      Response:
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      {event.responseText}
                    </div>
                  </div>
                )}

                {event.tasks && event.tasks.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 font-medium text-foreground/70 text-xs">
                      Tasks: {event.tasks.length}
                    </div>
                  </div>
                )}

                {event.statusUpdates && event.statusUpdates.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 font-medium text-foreground/70 text-xs">
                      Status Updates: {event.statusUpdates.length}
                    </div>
                  </div>
                )}

                {event.artifacts && event.artifacts.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 font-medium text-foreground/70 text-xs">
                      Artifacts: {event.artifacts.length}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <A2AJsonViewer data={event} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
