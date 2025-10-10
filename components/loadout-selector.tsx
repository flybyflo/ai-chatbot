"use client";

import { ChevronDown, Layers3 } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type Loadout = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  isDefault?: boolean;
  updatedAt?: string;
};

function EmptyRow({ message }: Readonly<{ message: string }>) {
  return (
    <div className="mx-1 my-1 rounded-sm bg-(--tool-bg) px-2 py-1.5 text-center text-muted-foreground text-xs">
      {message}
    </div>
  );
}

export function PureLoadoutSelector({
  loadouts = [],
  activeLoadoutId,
  onActivate, // (id: string | null) => void
}: Readonly<{
  loadouts?: Loadout[];
  activeLoadoutId?: string | null;
  onActivate?: (id: string | null) => void;
}>) {
  const [open, setOpen] = useState(false);
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
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    []
  );

  const handleValueSelect = useCallback(
    (loadoutId: string | null) => {
      onActivate?.(loadoutId);
      setOpen(false);
    },
    [onActivate]
  );

  const panelClass =
    "z-[1000] w-[340px] rounded-xl border border-border/30 bg-(--tool-bg) p-0 text-popover-foreground shadow-md backdrop-blur";

  return (
    <Popover onOpenChange={setOpen} open={open}>
      {/* Trigger (unchanged visually) */}
      <PopoverTrigger asChild>
        <button
          aria-label="Loadouts"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80"
          type="button"
        >
          <Layers3 size={16} />
          <span className="font-medium text-xs">Loadout</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className={panelClass}
        side="bottom"
        sideOffset={8}
      >
        {/* Search (compact) */}
        <div className="mx-0.5 mt-0.5 rounded-md border border-border/20 bg-(--tool-bg)">
          <input
            autoComplete="off"
            className="block w-full rounded-md bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70"
            key="loadout-search-input"
            onChange={handleSearchChange}
            placeholder="Search loadouts…"
            ref={inputRef}
            value={q}
          />
        </div>

        {/* List — compact rows with normalized rounding */}
        <div className="max-h-[320px] space-y-1 overflow-y-auto p-1">
          {!q && (
            <button
              className={`relative mx-0.5 w-[calc(100%-0.25rem)] cursor-default select-none rounded-md py-1.5 pr-2.5 pl-3 text-left text-xs outline-none transition-colors hover:bg-foreground/10 ${
                activeLoadoutId ? "" : "bg-foreground/15 font-semibold"
              }`}
              onClick={() => handleValueSelect(null)}
              type="button"
            >
              <span className="text-muted-foreground">None</span>
              {activeLoadoutId ? null : (
                <span className="-translate-y-1/2 absolute top-1/2 right-2">
                  ✓
                </span>
              )}
            </button>
          )}

          {filtered.length === 0 ? (
            q ? (
              <EmptyRow message="No loadouts match" />
            ) : null
          ) : (
            filtered.map((l) => {
              const isSelected = activeLoadoutId === l.id;
              return (
                <button
                  className={`relative mx-0.5 w-[calc(100%-0.25rem)] cursor-default select-none rounded-md py-1.5 pr-2.5 pl-3 text-left text-xs outline-none transition-colors hover:bg-foreground/10 ${
                    isSelected ? "bg-foreground/15 font-semibold" : ""
                  }`}
                  key={l.id}
                  onClick={() => handleValueSelect(l.id)}
                  type="button"
                >
                  <div className="truncate font-medium">{l.name}</div>
                  {l.description && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground leading-tight">
                      {l.description}
                    </div>
                  )}
                  {isSelected && (
                    <span className="-translate-y-1/2 absolute top-1/2 right-2">
                      ✓
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const LoadoutSelector = memo(PureLoadoutSelector);
