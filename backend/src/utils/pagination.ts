import { randomUUID } from "crypto";

import type { CursorMeta, PaginationMeta, PaginationOptions } from "../types";
import { DEFAULT_PAGE_SIZE, MAX_CURSOR_SIZE, MAX_PAGE_SIZE } from "../constants";

export function parsePagination(query: Record<string, unknown>): PaginationOptions {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.per_page) || DEFAULT_PAGE_SIZE)
  );
  return { page, per_page: perPage };
}

export function buildPaginationMeta(
  options: PaginationOptions,
  total: number
): PaginationMeta {
  const { page, per_page } = options;
  const totalPages = total === 0 ? 0 : Math.ceil(total / per_page);
  return {
    page,
    per_page,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}

/**
 * Cursor pagination — primary for large, append-heavy collections.
 * The cursor encodes `(id, created_at)` so ordering is stable under inserts.
 */
export function encodeCursor(id: string, sortValue?: Date | string | number): string {
  const payload = sortValue instanceof Date
    ? { id, s: sortValue.toISOString() }
    : { id, s: sortValue ?? null };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): { id: string; s: string | null } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      id?: unknown;
      s?: unknown;
    };
    if (typeof parsed.id !== "string" || parsed.id.length === 0) return null;
    return {
      id: parsed.id,
      s: typeof parsed.s === "string" ? parsed.s : typeof parsed.s === "number" ? String(parsed.s) : null,
    };
  } catch {
    return null;
  }
}

export function parseCursorPagination(
  query: Record<string, unknown>
): { cursor: string | undefined; limit: number } {
  const limit = Math.min(
    MAX_CURSOR_SIZE,
    Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE)
  );
  const cursor = typeof query.cursor === "string" && query.cursor.length > 0
    ? query.cursor
    : undefined;
  return { cursor, limit };
}

export function buildCursorMeta(
  hasMore: boolean,
  nextCursor: string | undefined
): CursorMeta {
  return {
    has_next: hasMore,
    next_cursor: hasMore && nextCursor ? nextCursor : null,
  };
}

export function newRequestId(): string {
  return randomUUID();
}
