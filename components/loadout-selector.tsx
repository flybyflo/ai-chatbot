"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Layers3 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const prefersReducedMotion = useReducedMotion();

  const activeLabel = useMemo(() => {
    if (!loadouts?.length || !activeLoadoutId) {
      return "None";
    }
    const active = loadouts.find((loadout) => loadout.id === activeLoadoutId);
    return active?.name ?? "None";
  }, [activeLoadoutId, loadouts]);

  const [frontLabel, setFrontLabel] = useState(activeLabel);
  const [backLabel, setBackLabel] = useState(activeLabel);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setFrontLabel(activeLabel);
      setBackLabel(activeLabel);
      setIsFlipped(false);
      return;
    }

    if (frontLabel === activeLabel) {
      setBackLabel(activeLabel);
      return;
    }

    const halfDuration = 300;
    const fullDuration = 600;

    setBackLabel(activeLabel);
    setIsFlipped(true);

    const midTimer = window.setTimeout(() => {
      setFrontLabel(activeLabel);
    }, halfDuration);

    const finishTimer = window.setTimeout(() => {
      setIsFlipped(false);
    }, fullDuration);

    return () => {
      window.clearTimeout(midTimer);
      window.clearTimeout(finishTimer);
    };
  }, [activeLabel, frontLabel, prefersReducedMotion]);

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
      {/* Trigger with flip animation */}
      <PopoverTrigger asChild>
        <motion.button
          animate={{ rotateX: isFlipped ? -180 : 0 }}
          aria-label="Loadouts"
          className={`relative flex h-9 min-w-[148px] items-center justify-center rounded-lg border border-transparent bg-transparent px-0 text-left text-foreground transition-colors duration-150 hover:border-border/60 data-[state=open]:border-border/80 ${
            isFlipped ? "pointer-events-none" : ""
          }`}
          initial={false}
          style={{
            transformStyle: "preserve-3d",
            transformPerspective: 800,
          }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          type="button"
        >
          <span className="pointer-events-none absolute inset-0 flex h-full w-full items-center gap-2 rounded-lg px-2.5 text-foreground [backface-visibility:hidden]">
            <Layers3 className="shrink-0" size={16} />
            <div className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                Loadout
              </span>
              <span className="truncate font-medium text-xs">{frontLabel}</span>
            </div>
            <ChevronDown className="shrink-0 text-muted-foreground" size={14} />
          </span>
          <span className="pointer-events-none absolute inset-0 flex h-full w-full items-center gap-2 rounded-lg px-2.5 text-foreground [backface-visibility:hidden] [transform:rotateX(180deg)]">
            <Layers3 className="shrink-0" size={16} />
            <div className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                Loadout
              </span>
              <span className="truncate font-medium text-xs">{backLabel}</span>
            </div>
            <ChevronDown className="shrink-0 text-muted-foreground" size={14} />
          </span>
        </motion.button>
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
