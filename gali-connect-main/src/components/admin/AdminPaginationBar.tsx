import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface AdminPaginationBarProps {
  pagination: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function AdminPaginationBar({
  pagination,
  onPageChange,
  className,
}: AdminPaginationBarProps) {
  if (!pagination || pagination.total_pages <= 1) return null;

  const { page, per_page, total, total_pages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * per_page + 1;
  const to = Math.min(page * per_page, total);
  const numbers = pageNumbers(page, total_pages);

  return (
    <div
      className={cn("flex flex-col sm:flex-row items-center justify-between gap-3 pt-4", className)}
    >
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={!pagination.has_prev}
          aria-label="First page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.has_prev}
          aria-label="Previous page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1 px-1">
          {numbers.map((num, idx) =>
            num === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                className="h-8 w-5 inline-flex items-center justify-center text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={num}
                onClick={() => onPageChange(num)}
                aria-current={num === page ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-sm font-semibold border transition-colors",
                  num === page
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {num}
              </button>
            ),
          )}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.has_next}
          aria-label="Next page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(total_pages)}
          disabled={!pagination.has_next}
          aria-label="Last page"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
