'use client';

import * as React from 'react';
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
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns,
  MoreHorizontal,
  Wrench,
  Copy,
} from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.any().optional(),
});

const columns: ColumnDef<z.infer<typeof mcpToolSchema>>[] = [
  {
    accessorKey: 'name',
    header: 'Tool Name',
    cell: ({ row }) => (
      <div className="font-medium text-xs">{row.original.name}</div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="text-xs text-muted-foreground max-w-md">
        {row.original.description || 'No description provided'}
      </div>
    ),
  },
  {
    accessorKey: 'inputSchema',
    header: 'Parameters',
    cell: ({ row }) => {
      const schema = row.original.inputSchema;
      if (!schema || !schema.properties) {
        return <span className="text-xs text-muted-foreground">None</span>;
      }
      
      const paramCount = Object.keys(schema.properties).length;
      return (
        <Badge variant="secondary" className="px-1.5 text-xs h-5">
          {paramCount} param{paramCount !== 1 ? 's' : ''}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row, table }) => {
      const handleViewSchema = () => {
        (table.options.meta as any)?.onViewSchema?.(row.original);
      };
      
      const handleCopyName = () => {
        navigator.clipboard.writeText(row.original.name);
      };

      return (
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
            <DropdownMenuItem onClick={handleViewSchema}>
              View Schema
            </DropdownMenuItem>
            <DropdownMenuItem>Test Tool</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyName}>
              <Copy className="size-3 mr-2" />
              Copy Name
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function MCPToolsDataTable({
  data: initialData,
}: {
  data: z.infer<typeof mcpToolSchema>[];
}) {
  const [data, setData] = React.useState(() => initialData);
  const [selectedTool, setSelectedTool] = React.useState<z.infer<typeof mcpToolSchema> | null>(null);
  const [isSchemaDialogOpen, setIsSchemaDialogOpen] = React.useState(false);

  // Update data when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);
  
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const handleViewSchema = React.useCallback((tool: z.infer<typeof mcpToolSchema>) => {
    setSelectedTool(tool);
    setIsSchemaDialogOpen(true);
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
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
      onViewSchema: handleViewSchema,
    },
  });

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-base font-semibold">Available Tools</h3>
          <Badge variant="secondary" className="text-xs">
            {data.length} tool{data.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="size-4" />
                <span className="hidden lg:inline">Columns</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== 'undefined' &&
                    column.getCanHide()
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
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto mt-4">
        <div className="overflow-hidden rounded-lg border">
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
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="h-8"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-8 px-3 py-0.5 text-xs">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="h-20">
                  <TableCell
                    colSpan={columns.length}
                    className="h-20 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Wrench className="size-6 text-muted-foreground" />
                      <div className="text-xs text-muted-foreground">
                        No tools available
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {data.length > 10 && (
          <div className="flex items-center justify-between px-4">
            <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
              Showing {Math.min(data.length, pagination.pageSize)} of {data.length} tools
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="tools-rows-per-page" className="text-sm font-medium">
                  Rows per page
                </Label>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                >
                  <SelectTrigger className="h-8 w-20" id="tools-rows-per-page">
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
        )}
      </div>

      {/* Schema Dialog */}
      <Dialog open={isSchemaDialogOpen} onOpenChange={setIsSchemaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Tool Schema: {selectedTool?.name}</DialogTitle>
            <DialogDescription>
              Input schema and parameters for this tool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTool?.description && (
              <div>
                <h4 className="font-medium text-sm mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedTool.description}</p>
              </div>
            )}
            
            {selectedTool?.inputSchema ? (
              <div>
                <h4 className="font-medium text-sm mb-2">Input Schema</h4>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-sm mb-2">Input Schema</h4>
                <p className="text-sm text-muted-foreground">No input schema defined for this tool.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}