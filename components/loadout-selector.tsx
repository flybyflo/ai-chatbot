"use client";

import { Trigger } from "@radix-ui/react-select";
import { ChevronDown, Layers3 } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { SelectItem } from "@/components/ui/select";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

export type Loadout = {
  id: string;
  name: string;
  description?: string;
  tags?: string[]; // e.g., ["research", "prod"]
  isDefault?: boolean;
  updatedAt?: string; // ISO
};

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-2 py-2 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
}

export function PureLoadoutSelector({
  loadouts = [],
  activeLoadoutId,
  onActivate, // (id: string) => void
}: {
  loadouts?: Loadout[];
  activeLoadoutId?: string | null;
  onActivate?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!q) {
      return loadouts;
    }
    const needle = q.toLowerCase();
    return loadouts.filter((l) =>
      [l.name, l.description, ...(l.tags ?? [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    );
  }, [q, loadouts]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQ(e.target.value);
      // Maintain focus after state update
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    []
  );

  // Focus the input when the dropdown opens
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);

  const handleValueChange = useCallback(
    (loadoutName: string) => {
      if (loadoutName === "__none__") {
        onActivate?.(null as any);
        return;
      }
      const loadout = loadouts.find((l) => l.name === loadoutName);
      if (loadout) {
        onActivate?.(loadout.id);
      }
    },
    [loadouts, onActivate]
  );

  const currentValue = useMemo(
    () => loadouts.find((l) => l.id === activeLoadoutId)?.name || "__none__",
    [loadouts, activeLoadoutId]
  );

  const handleItemClick = useCallback(
    (loadoutId: string | null) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onActivate?.(loadoutId as any);
    },
    [onActivate]
  );

  // Common compact trigger style: outline only on hover/open
  const triggerClass =
    "flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground " +
    "transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80";

  // Dropdown panel: minimal padding, subtle border/blur
  const panelClass =
    "z-[1000] w-[360px] rounded-lg border border-border/30 bg-popover p-0 text-popover-foreground shadow-md backdrop-blur";

  return (
    <PromptInputModelSelect
      onOpenChange={handleOpenChange}
      onValueChange={handleValueChange}
      value={currentValue}
    >
      <Trigger aria-label="Loadouts" className={triggerClass} type="button">
        <Layers3 size={16} />
        <span className="font-medium text-xs">Loadout</span>
        <ChevronDown size={14} />
      </Trigger>

      <PromptInputModelSelectContent className={panelClass}>
        {/* Search — edge-to-edge */}
        <div className="border-border/20 border-b">
          <input
            autoComplete="off"
            className="block w-full bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
            key="loadout-search-input"
            onChange={handleSearchChange}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Search loadouts…"
            ref={inputRef}
            value={q}
          />
        </div>

        {/* List */}
        <div className="divide-y divide-border/20">
          {/* None option - always shown unless search query exists */}
          {!q && (
            <SelectItem
              className="relative w-full cursor-default select-none py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
              onClick={handleItemClick(null)}
              value="__none__"
            >
              <span className="text-muted-foreground">None</span>
            </SelectItem>
          )}

          {filtered.length === 0 ? (
            q ? (
              <EmptyRow message="No loadouts match" />
            ) : null
          ) : (
            filtered.map((l) => (
              <SelectItem
                className="relative w-full cursor-default select-none py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
                key={l.id}
                onClick={handleItemClick(l.id)}
                value={l.name}
              >
                {l.name}
              </SelectItem>
            ))
          )}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const LoadoutSelector = memo(PureLoadoutSelector);
