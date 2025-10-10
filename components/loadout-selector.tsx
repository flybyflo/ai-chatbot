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

function EmptyRow({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-2 my-1 rounded-lg bg-(--tool-bg) px-2 py-2 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
}

export function PureLoadoutSelector({
  loadouts = [],
  activeLoadoutId,
  onActivate, // (id: string) => void
}: Readonly<{
  loadouts?: Loadout[];
  activeLoadoutId?: string | null;
  onActivate?: (id: string | null) => void;
}>) {
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
        onActivate?.(null);
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
      onActivate?.(loadoutId);
    },
    [onActivate]
  );

  // Trigger unchanged; panel uses tool-bg + rounded
  const panelClass =
    "z-[1000] w-[360px] rounded-2xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur";

  return (
    <PromptInputModelSelect
      onOpenChange={handleOpenChange}
      onValueChange={handleValueChange}
      value={currentValue}
    >
      <Trigger
        aria-label="Loadouts"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
        type="button"
      >
        <Layers3 size={16} />
        <span className="font-medium text-xs">Loadout</span>
        <ChevronDown size={14} />
      </Trigger>

      <PromptInputModelSelectContent className={panelClass}>
        {/* Search — rounded container with tool-bg */}
        <div className="mx-1 mt-1 rounded-xl border border-border/20 bg-(--tool-bg)">
          <input
            autoComplete="off"
            className="block w-full rounded-xl bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/70"
            key="loadout-search-input"
            onChange={handleSearchChange}
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Search loadouts…"
            ref={inputRef}
            value={q}
          />
        </div>

        {/* List — rounded rows */}
        <div className="max-h-[360px] space-y-1.5 overflow-y-auto p-1.5">
          {!q && (
            <SelectItem
              className="relative mx-1 w-[calc(100%-0.5rem)] cursor-default select-none rounded-xl py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
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
                className="relative mx-1 w-[calc(100%-0.5rem)] cursor-default select-none rounded-xl py-2 pr-2.5 pl-8 text-xs outline-none transition-colors hover:bg-foreground/10 focus:bg-foreground/10 data-[state=checked]:bg-foreground/15"
                key={l.id}
                onClick={handleItemClick(l.id)}
                value={l.name}
              >
                <div className="truncate font-medium">{l.name}</div>
                {l.description && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground leading-tight">
                    {l.description}
                  </div>
                )}
              </SelectItem>
            ))
          )}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const LoadoutSelector = memo(PureLoadoutSelector);
