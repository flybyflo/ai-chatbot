"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { A2AAgentCard } from "@/components/a2a";
import { useDataStream } from "@/components/data-stream-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterState = "all" | "ready" | "error";

export default function A2AAgentsPage() {
  const { a2aRegistry } = useDataStream();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<FilterState>("all");

  const agents = useMemo(() => {
    if (!a2aRegistry) {
      return [];
    }
    return Object.values(a2aRegistry.agents);
  }, [a2aRegistry]);

  const filteredAgents = useMemo(() => {
    let result = agents;

    if (filterState === "ready") {
      result = result.filter((agent) => agent.isReady);
    } else if (filterState === "error") {
      result = result.filter((agent) => !agent.isReady);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.displayName.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query) ||
          agent.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [agents, filterState, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl">A2A Agent Registry</h1>
        <p className="text-muted-foreground">
          Browse agent capabilities and documentation.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            value={searchQuery}
          />
        </div>
        <Select
          onValueChange={(value) => setFilterState(value as FilterState)}
          value={filterState}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="ready">Ready Only</SelectItem>
            <SelectItem value="error">Errors Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="font-semibold text-foreground">No agents found</p>
            <p className="text-muted-foreground text-sm">
              {agents.length === 0
                ? "Configure A2A servers to see agents here"
                : "Try adjusting your search or filter"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <A2AAgentCard agent={agent} key={agent.id} />
          ))}
        </div>
      )}
    </div>
  );
}
