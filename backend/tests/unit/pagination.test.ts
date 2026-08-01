import {
  buildCursorMeta,
  buildPaginationMeta,
  decodeCursor,
  encodeCursor,
  parseCursorPagination,
  parsePagination,
} from "../../src/utils/pagination";
import { MAX_CURSOR_SIZE, MAX_PAGE_SIZE } from "../../src/constants";

describe("pagination utils", () => {
  describe("offset pagination", () => {
    it("parses defaults", () => {
      expect(parsePagination({})).toEqual({ page: 1, per_page: 20 });
    });

    it("parses explicit values", () => {
      expect(parsePagination({ page: "3", per_page: "10" })).toEqual({ page: 3, per_page: 10 });
    });

    it("clamps per_page to MAX_PAGE_SIZE and page to >= 1", () => {
      expect(parsePagination({ page: "0", per_page: "9999" })).toEqual({ page: 1, per_page: MAX_PAGE_SIZE });
    });

    it("builds meta with total pages", () => {
      const meta = buildPaginationMeta({ page: 2, per_page: 10 }, 25);
      expect(meta).toEqual({
        page: 2,
        per_page: 10,
        total: 25,
        total_pages: 3,
        has_next: true,
        has_prev: true,
      });
    });

    it("handles empty result sets", () => {
      const meta = buildPaginationMeta({ page: 1, per_page: 10 }, 0);
      expect(meta.total_pages).toBe(0);
      expect(meta.has_next).toBe(false);
    });
  });

  describe("cursor pagination", () => {
    it("round-trips a cursor with a date sort value", () => {
      const date = new Date("2026-01-15T10:00:00.000Z");
      const cursor = encodeCursor("p1", date);
      expect(decodeCursor(cursor)).toEqual({ id: "p1", s: "2026-01-15T10:00:00.000Z" });
    });

    it("round-trips a cursor without a sort value", () => {
      const cursor = encodeCursor("p1");
      expect(decodeCursor(cursor)).toEqual({ id: "p1", s: null });
    });

    it("round-trips a numeric sort value", () => {
      const cursor = encodeCursor("p1", 1234);
      expect(decodeCursor(cursor)).toEqual({ id: "p1", s: "1234" });
    });

    it("returns null for an empty or invalid cursor", () => {
      expect(decodeCursor(undefined)).toBeNull();
      expect(decodeCursor("not-base64url-json")).toBeNull();
      expect(decodeCursor("")).toBeNull();
    });

    it("rejects a cursor that decodes to a non-string id", () => {
      const bad = Buffer.from(JSON.stringify({ id: 123 })).toString("base64url");
      expect(decodeCursor(bad)).toBeNull();
    });

    it("parses cursor query params with defaults", () => {
      expect(parseCursorPagination({})).toEqual({ cursor: undefined, limit: 20 });
      expect(parseCursorPagination({ cursor: "abc", limit: "50" })).toEqual({ cursor: "abc", limit: 50 });
    });

    it("clamps limit to MAX_CURSOR_SIZE", () => {
      expect(parseCursorPagination({ limit: "9999" }).limit).toBe(MAX_CURSOR_SIZE);
    });

    it("ignores empty cursor strings", () => {
      expect(parseCursorPagination({ cursor: "" }).cursor).toBeUndefined();
    });

    it("builds cursor meta", () => {
      expect(buildCursorMeta(true, "next")).toEqual({ has_next: true, next_cursor: "next" });
      expect(buildCursorMeta(false, undefined)).toEqual({ has_next: false, next_cursor: null });
    });
  });
});
