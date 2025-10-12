"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { A2AAgentCard } from "@/components/a2a";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useA2APersistedData } from "@/hooks/use-a2a-persisted-data";
import { FILTER_STATES, type FilterState } from "@/lib/enums";

export default function A2AAgentsPage() {
  const { registry } = useA2APersistedData();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<FilterState>(
    FILTER_STATES.ALL
  );

  const agents = useMemo(() => {
    if (!registry) {
      return [];
    }
    return Object.values(registry.agents);
  }, [registry]);

  const filteredAgents = useMemo(() => {
    let result = agents;

    if (filterState === FILTER_STATES.READY) {
      result = result.filter((agent) => agent.isReady);
    } else if (filterState === FILTER_STATES.ERROR) {
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
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl">A2A Agent Registry</h1>
        <p className="text-muted-foreground text-sm">
          Browse agent capabilities and documentation.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground" />
          <Input
            className="pl-8 text-sm"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            value={searchQuery}
          />
        </div>
        <Select
          onValueChange={(value) => setFilterState(value as FilterState)}
          value={filterState}
        >
          <SelectTrigger className="w-full sm:w-[160px] text-sm">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_STATES.ALL}>All Agents</SelectItem>
            <SelectItem value={FILTER_STATES.READY}>Ready Only</SelectItem>
            <SelectItem value={FILTER_STATES.ERROR}>Errors Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed bg-muted/40">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <A2AAgentCard agent={agent} key={agent.id} />
          ))}
        </div>
      )}
    </div>
  );
}
