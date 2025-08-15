'use client';

import * as React from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  MoreHorizontal,
  GripVertical,
  Columns,
  Loader2,
  Plus,
  Server,
} from 'lucide-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const mcpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  status: z.enum([
    'connected',
    'disabled',
    'error',
    'loading',
    'auth_required',
  ]),
  description: z.string().optional(),
  authToken: z.string().optional(),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  isEnabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-6 hover:bg-transparent"
    >
      <GripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

const getStatusColor = (status: z.infer<typeof mcpServerSchema>['status']) => {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'disabled':
      return 'bg-gray-400';
    case 'error':
      return 'bg-red-500';
    case 'auth_required':
      return 'bg-orange-500';
    case 'loading':
      return 'bg-orange-400';
    default:
      return 'bg-gray-500';
  }
};

const getStatusText = (status: z.infer<typeof mcpServerSchema>['status']) => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'disabled':
      return 'Disabled';
    case 'error':
      return 'Error';
    case 'auth_required':
      return 'Auth Required';
    case 'loading':
      return 'Loading...';
    default:
      return 'Unknown';
  }
};

const columns: ColumnDef<z.infer<typeof mcpServerSchema>>[] = [
  {
    id: 'drag',
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: 'Server Name',
    cell: ({ row, table }) => {
      const handleNavigate = () => {
        (table.options.meta as any)?.onNavigateToServer?.(row.original.id);
      };

      return (
        <Button
          variant="link"
          className="text-foreground w-fit px-0 text-left text-xs h-auto font-normal"
          onClick={handleNavigate}
        >
          {row.original.name}
        </Button>
      );
    },
    enableHiding: false,
  },
  {
    accessorKey: 'url',
    header: 'URL',
    cell: ({ row }) => (
      <div className="font-mono text-xs text-muted-foreground max-w-xs truncate">
        {row.original.url}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-muted-foreground px-1.5 text-xs h-5"
        >
          {row.original.status === 'connected' ? (
            <CheckCircle className="fill-green-500 dark:fill-green-400 size-3 mr-1" />
          ) : row.original.status === 'loading' ? (
            <Loader2 className="size-3 mr-1 animate-spin" />
          ) : null}
          {getStatusText(row.original.status)}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: 'tools',
    header: 'Tools',
    cell: ({ row }) => (
      <div className="w-12">
        {row.original.tools && row.original.tools.length > 0 ? (
          <Badge variant="secondary" className="px-1.5 text-xs h-5">
            {row.original.tools.length}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">0</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'isEnabled',
    header: 'Enabled',
    cell: ({ row }) => (
      <Checkbox
        checked={row.original.isEnabled}
        onCheckedChange={(checked) => {
          // Handle enable/disable logic here
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `${checked ? 'Enabling' : 'Disabling'} ${row.original.name}`,
            success: 'Status updated',
            error: 'Failed to update status',
          });
        }}
        aria-label={`${row.original.isEnabled ? 'Disable' : 'Enable'} server`}
      />
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-6"
            size="icon"
          >
            <MoreHorizontal className="size-3" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Test Connection</DropdownMenuItem>
          <DropdownMenuItem>View Tools</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

function DraggableRow({ row }: { row: Row<z.infer<typeof mcpServerSchema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && 'selected'}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 h-8 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="h-8 px-3 py-0.5 text-xs">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function MCPServerDataTable({
  data: initialData,
  onServerAdd,
  onServerUpdate,
  onServerDelete,
}: {
  data: z.infer<typeof mcpServerSchema>[];
  onServerAdd?: () => void;
  onServerUpdate?: (server: z.infer<typeof mcpServerSchema>) => void;
  onServerDelete?: (serverId: string) => void;
}) {
  const [data, setData] = React.useState(() => initialData);
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // Update data when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleNavigateToServer = React.useCallback(
    (serverId: string) => {
      router.push(`/settings/mcp/${serverId}`);
    },
    [router],
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: {
      onNavigateToServer: handleNavigateToServer,
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(data, oldIndex, newIndex);
      });
    }
  }

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">MCP Servers</h2>
          <Badge variant="secondary" className="text-xs">
            {data.length} server{data.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="size-4" />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== 'undefined' &&
                    column.getCanHide(),
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onServerAdd}>
            <Plus className="size-4" />
            <span className="hidden lg:inline">Add Server</span>
            <span className="lg:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6 mt-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="h-8">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className="h-8 px-3 py-1 text-xs font-medium"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow className="h-20">
                    <TableCell
                      colSpan={columns.length}
                      className="h-20 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Server className="size-6 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          No MCP servers configured
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onServerAdd}
                          className="h-6 px-2 text-xs"
                        >
                          <Plus className="size-3" />
                          Add your first server
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
