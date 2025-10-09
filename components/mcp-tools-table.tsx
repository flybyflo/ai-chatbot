"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Sparkles, ToggleLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type Updater,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const schema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  serverName: z.string().optional(),
});

type ToolRow = z.infer<typeof schema>;

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      {...attributes}
      {...listeners}
      size="icon"
      variant="ghost"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <GripVertical className="size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

function DraggableRow({ row }: { row: Row<ToolRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.id,
  });

  return (
    <TableRow
      ref={setNodeRef}
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:shadow-lg"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="align-top">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

type MCPToolsTableProps = {
  tools: ToolRow[];
  selectedToolIds: string[];
  onSelectedToolsChange: (ids: string[]) => void;
};

export function MCPToolsTable({
  tools,
  selectedToolIds,
  onSelectedToolsChange,
}: MCPToolsTableProps) {
  const [data, setData] = useState(() => tools);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    setData(tools);
  }, [tools]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const dataIds = useMemo(() => data.map((row) => row.id), [data]);

  const rowSelection = useMemo<RowSelectionState>(() => {
    return selectedToolIds.reduce<RowSelectionState>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
  }, [selectedToolIds]);

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const nextState =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const nextIds = Object.keys(nextState).filter((key) => nextState[key]);
      onSelectedToolsChange(nextIds);
    },
    [onSelectedToolsChange, rowSelection]
  );

  const toggleSingle = useCallback(
    (toolId: string) => {
      const isActive = rowSelection[toolId];
      const next = isActive
        ? selectedToolIds.filter((id) => id !== toolId)
        : [...selectedToolIds, toolId];
      onSelectedToolsChange(next);
    },
    [onSelectedToolsChange, rowSelection, selectedToolIds]
  );

  const columns = useMemo<ColumnDef<ToolRow>[]>(
    () => [
      {
        id: "drag",
        header: () => null,
        cell: ({ row }) => <DragHandle id={row.id} />,
        enableHiding: false,
      },
      {
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label="Select all"
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              aria-label={`Select ${row.original.name}`}
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Tool",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border border-primary/20 text-[10px]"
              >
                <Sparkles className="mr-1 h-3 w-3" /> Tool
              </Badge>
              <span className="font-semibold text-sm text-foreground">
                {row.original.name}
              </span>
            </div>
            {row.original.description ? (
              <p className="text-muted-foreground text-xs">
                {row.original.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "id",
        header: "Identifier",
        cell: ({ row }) => (
          <code className="rounded-md bg-muted px-2 py-1 text-xs">
            {row.original.id}
          </code>
        ),
      },
      {
        accessorKey: "serverName",
        header: "Server",
        cell: ({ row }) =>
          row.original.serverName ? (
            <Badge className="bg-slate-900/5 text-[10px] font-semibold dark:bg-slate-100/10">
              {row.original.serverName}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const active = row.getIsSelected();
          return (
            <Badge
              className={cn(
                "text-[10px]",
                active
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-border/60 bg-muted text-muted-foreground"
              )}
              variant="outline"
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const active = row.getIsSelected();
          return (
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "size-8 rounded-full border border-transparent",
                active
                  ? "text-emerald-600 hover:border-emerald-500/40 hover:bg-emerald-500/10 dark:text-emerald-200"
                  : "text-muted-foreground hover:border-border/50 hover:bg-muted"
              )}
              onClick={() => toggleSingle(row.original.id)}
            >
              <ToggleLeft className="size-4" />
              <span className="sr-only">
                {active ? "Deactivate" : "Activate"} {row.original.name}
              </span>
            </Button>
          );
        },
      },
    ],
    [toggleSingle]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onRowSelectionChange: handleRowSelectionChange,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setData((prev) => {
          const oldIndex = prev.findIndex((item) => item.id === active.id);
          const newIndex = prev.findIndex((item) => item.id === over.id);
          if (oldIndex === -1 || newIndex === -1) {
            return prev;
          }
          const next = [...prev];
          const [moved] = next.splice(oldIndex, 1);
          next.splice(newIndex, 0, moved);
          return next;
        });
      }
    },
    []
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex flex-col gap-2 border-border/60 border-b bg-white/80 px-4 py-3 dark:bg-zinc-950/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Tools Overview
            </h3>
            <p className="text-muted-foreground text-xs">
              {selectedToolIds.length} of {data.length} tools active
            </p>
          </div>
          <Input
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search tools…"
            className="h-9 w-full max-w-xs rounded-lg border-border/60 bg-transparent text-sm"
          />
        </div>
      </div>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader className="bg-muted/40 text-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="**:data-[slot=table-cell]:align-middle">
            {table.getRowModel().rows.length ? (
              <SortableContext
                items={dataIds}
                strategy={verticalListSortingStrategy}
              >
                {table.getRowModel().rows.map((row) => (
                  <DraggableRow key={row.id} row={row} />
                ))}
              </SortableContext>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No tools found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>
      <div className="flex flex-col gap-2 border-border/60 border-t bg-white/80 px-4 py-3 text-xs text-muted-foreground dark:bg-zinc-950/70 md:flex-row md:items-center md:justify-between">
        <div>
          {Object.keys(rowSelection).filter((key) => rowSelection[key]).length} of {" "}
          {table.getFilteredRowModel().rows.length} selected
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-border/60"
            onClick={() => onSelectedToolsChange([])}
          >
            Clear selection
          </Button>
          <div className="flex items-center gap-1">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Previous page</span>
              ‹
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Next page</span>
              ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
