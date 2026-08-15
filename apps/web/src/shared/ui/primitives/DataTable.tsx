"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { Select } from "./Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

export interface DataTableColumn<T> {
  field: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
}

type SortOrder = "asc" | "desc";

interface DataTableBaseProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  rowKey?: (row: T, index: number) => string;
}

interface DataTableServerProps<T> extends DataTableBaseProps<T> {
  serverSide: true;
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onSort?: (field: string, order: SortOrder) => void;
  onSearch?: (term: string) => void;
  sortField?: string;
  sortOrder?: SortOrder;
}

interface DataTableClientProps<T> extends DataTableBaseProps<T> {
  serverSide?: false;
}

export type DataTableProps<T> = DataTableServerProps<T> | DataTableClientProps<T>;

const PAGE_SIZE_OPTIONS = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

function getFieldValue<T>(row: T, field: string): unknown {
  return (row as Record<string, unknown>)[field];
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  const maxButtons = 5;
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);
  if (start === 2) end = Math.min(4, totalPages - 1);
  if (end === totalPages - 1) start = Math.max(2, totalPages - 3);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export function DataTable<T>(props: DataTableProps<T>) {
  const { columns, data, isLoading = false, rowKey } = props;
  const serverSide = props.serverSide === true;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(10);
  const [localSortField, setLocalSortField] = useState("");
  const [localSortOrder, setLocalSortOrder] = useState<SortOrder>("asc");

  // Latest onSearch kept in a ref so the effect below only re-fires when the
  // debounced search text actually changes, not on every parent re-render
  // (the callback prop is a fresh closure each render).
  const onSearchRef = useRef(serverSide ? props.onSearch : undefined);
  onSearchRef.current = serverSide ? props.onSearch : undefined;

  useEffect(() => {
    onSearchRef.current?.(debouncedSearch);
  }, [debouncedSearch]);

  const filteredSorted = useMemo(() => {
    if (serverSide) return data;
    let result = data;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row as Record<string, unknown>).join(" ").toLowerCase().includes(term),
      );
    }
    if (localSortField) {
      result = [...result].sort((a, b) => {
        const av = getFieldValue(a, localSortField);
        const bv = getFieldValue(b, localSortField);
        if (typeof av === "string" && typeof bv === "string") {
          return localSortOrder === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        const an = Number(av) || 0;
        const bn = Number(bv) || 0;
        return localSortOrder === "asc" ? an - bn : bn - an;
      });
    }
    return result;
  }, [serverSide, data, searchTerm, localSortField, localSortOrder]);

  const page = serverSide ? props.page : localPage;
  const pageSize = serverSide ? props.pageSize : localPageSize;
  const totalItems = serverSide ? props.totalItems : filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const sortField = serverSide ? props.sortField ?? "" : localSortField;
  const sortOrder = serverSide ? props.sortOrder ?? "asc" : localSortOrder;

  const currentData = serverSide ? data : filteredSorted.slice((localPage - 1) * localPageSize, localPage * localPageSize);

  function handleSort(field: string) {
    const nextOrder: SortOrder = field === sortField && sortOrder === "asc" ? "desc" : "asc";
    if (serverSide) {
      props.onSort?.(field, nextOrder);
    } else {
      setLocalSortField(field);
      setLocalSortOrder(nextOrder);
    }
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    if (serverSide) {
      props.onPageChange(nextPage, pageSize);
    } else {
      setLocalPage(nextPage);
    }
  }

  function handlePageSizeChange(value: string) {
    const size = parseInt(value, 10);
    if (serverSide) {
      props.onPageChange(1, size);
    } else {
      setLocalPageSize(size);
      setLocalPage(1);
    }
  }

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!serverSide) setLocalPage(1);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(pageSize)}
            options={PAGE_SIZE_OPTIONS}
            onChange={handlePageSizeChange}
            className="w-20"
          />
          <span>entries</span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.field}
                onClick={() => column.sortable !== false && handleSort(column.field)}
                className={cn(column.sortable !== false && "cursor-pointer select-none")}
              >
                <div className="flex items-center gap-1">
                  <span>{column.header}</span>
                  {column.sortable !== false &&
                    (sortField === column.field ? (
                      sortOrder === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                    ))}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((column) => (
                  <TableCell key={column.field}>
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : currentData.length > 0 ? (
            currentData.map((row, index) => (
              <TableRow key={rowKey ? rowKey(row, index) : index}>
                {columns.map((column) => (
                  <TableCell key={column.field}>
                    {column.render
                      ? column.render(getFieldValue(row, column.field), row)
                      : (getFieldValue(row, column.field) as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                No records found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Showing {from} to {to} of {totalItems} entries
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="rounded-lg border border-input p-2 text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                className={cn(
                  "rounded-md border px-3 py-1 text-sm",
                  p === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-accent",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="rounded-lg border border-input p-2 text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
