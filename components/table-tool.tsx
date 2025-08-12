'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns,
  FileDown,
  FileSpreadsheet,
  Copy as CopyIcon,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type RenderTablePayload = {
  caption?: string;
  columns: Array<{
    id: string;
    header?: string;
    accessorKey?: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
  }>;
  rows: Array<Record<string, any>>;
  initialSorting?: Array<{ id: string; desc?: boolean }>;
  pageSize?: number;
};

export function TableTool({
  data,
}: {
  data: RenderTablePayload;
}) {
  const [sorting, setSorting] = useState<SortingState>(
    () => data.initialSorting?.map((s) => ({ id: s.id, desc: !!s.desc })) ?? [],
  );
  const [globalFilter, setGlobalFilter] = useState<string>('');

  const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    return data.columns.map((c) => ({
      id: c.id,
      accessorKey: c.accessorKey ?? c.id,
      header: c.header ?? c.id,
      enableSorting: true,
      size: c.width,
      meta: { align: c.align },
      cell: (info) => {
        const value = info.getValue<any>();
        return typeof value === 'object'
          ? JSON.stringify(value)
          : String(value ?? '');
      },
    }));
  }, [data.columns]);

  const table = useReactTable({
    data: data.rows,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: true,
    enableSorting: true,
    enableGlobalFilter: true,
    globalFilterFn: 'includesString',
    initialState: {
      pagination: {
        pageSize: data.pageSize ?? 10,
      },
    },
  });

  // Utilities for exporting and copying
  const getVisibleColumns = () => table.getVisibleLeafColumns();
  const escapeCsv = (value: string) => {
    const mustQuote = /[",\n]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return mustQuote ? `"${escaped}"` : escaped;
  };
  const getHeaderText = (col: any) => {
    const header = col.columnDef.header;
    return typeof header === 'string' ? header : String(col.id ?? '');
  };
  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportCsv = () => {
    const cols = getVisibleColumns();
    const headers = cols.map((c) => escapeCsv(getHeaderText(c)));
    const rows = table.getFilteredRowModel().rows.map((r) =>
      cols
        .map((c) => {
          const v = r.getValue<any>(c.id);
          return escapeCsv(v == null ? '' : String(v));
        })
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    download('table.csv', csv, 'text/csv;charset=utf-8;');
  };
  const exportExcel = () => {
    const cols = getVisibleColumns();
    const headers = cols.map((c) => getHeaderText(c));
    const rows = table.getFilteredRowModel().rows.map((r) =>
      cols.map((c) => {
        const v = r.getValue<any>(c.id);
        return v == null ? '' : String(v);
      }),
    );
    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyMarkdown = async () => {
    const cols = getVisibleColumns();
    const headers = cols.map((c) => getHeaderText(c));
    const alignRow = cols
      .map((c) => {
        const align = (c.columnDef as any)?.meta?.align;
        return align === 'right'
          ? '---:'
          : align === 'center'
            ? ':---:'
            : '---';
      })
      .join(' | ');
    const rows = table.getFilteredRowModel().rows.map((r) =>
      cols
        .map((c) => {
          const v = r.getValue<any>(c.id);
          return v == null ? '' : String(v).replace(/\n/g, ' ');
        })
        .join(' | '),
    );
    const md = `| ${headers.join(' | ')} |\n| ${alignRow} |\n${rows.map((line) => `| ${line} |`).join('\n')}`;
    await navigator.clipboard.writeText(md);
  };

  const hasMultiplePages = table.getPageCount() > 1;

  return (
    <div className="relative flex flex-col gap-4 overflow-auto">
      {/* Top toolbar: Search bar (left) and Customize Columns (right) */}
      <div className="flex items-center justify-between px-2 gap-4 mt-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search table..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 h-8 w-64"
            />
          </div>
        </div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" suppressHydrationWarning>
                <Columns />
                <span className="hidden md:inline">Customize Columns</span>
                <span className="md:hidden">Columns</span>
                <ChevronDown />
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
                .map((column) => (
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
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => table.resetColumnVisibility()}>
                Reset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          {/* Caption intentionally omitted per request */}
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta: any = header.column.columnDef.meta;
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                      className={
                        meta?.align === 'center'
                          ? 'text-center'
                          : meta?.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                      }
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="select-none cursor-pointer">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: ' ▲',
                            desc: ' ▼',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="relative z-0"
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta: any = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={
                          meta?.align === 'center'
                            ? 'text-center'
                            : meta?.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={data.columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bottom pagination bar */}
      <div className="flex items-center justify-between px-2 gap-4">
        {/* Left: single export icon with dropdown */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="size-8 p-0"
                suppressHydrationWarning
              >
                <FileDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={exportCsv}>
                <FileDown className="size-4" />
                <span>Export CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="size-4" />
                <span>Export Excel</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyMarkdown}>
                <CopyIcon className="size-4" />
                <span>Copy as Markdown</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Right: rows-per-page always; page info + nav shown only if > 1 page */}
        <div className="flex w-full items-center gap-6 md:w-fit">
          <div className="hidden items-center gap-2 md:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger
                id="rows-per-page"
                className="w-20 h-8"
                suppressHydrationWarning
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((sz) => (
                  <SelectItem key={sz} value={String(sz)}>
                    {sz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasMultiplePages && (
            <>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </div>
              <div className="ml-auto flex items-center gap-2 md:ml-0">
                <Button
                  variant="outline"
                  className="hidden size-8 p-0 md:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-8 md:flex"
                  size="icon"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
