const UNIT_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function parseDurationToMs(duration: string, fallbackMs = 86_400_000): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    return fallbackMs;
  }
  const value = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_MS;
  return value * UNIT_MS[unit];
}

export function parseDurationToSeconds(duration: string, fallbackSeconds = 604_800): number {
  return Math.floor(parseDurationToMs(duration, fallbackSeconds * 1000) / 1000);
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a user-supplied date bound for a range filter.
 *
 * Contract: the `from` bound is inclusive and the `to` bound includes the whole
 * end day, so filters labelled "from X to Y" return orders created anywhere on
 * Y (no off-by-one).
 *
 * - `YYYY-MM-DD` (date-only) is treated as a server-local calendar day and is
 *   expanded to local 00:00:00.000 (start) or 23:59:59.999 (end-of-day). Using
 *   local-time bounds keeps the query consistent with how rows are created and
 *   avoids UTC/local midnight drift.
 * - A full timestamp is honoured as-is, except that an explicit UTC midnight is
 *   normalised to end-of-day so `to=2026-08-13T00:00:00Z` still includes the
 *   13th.
 *
 * Returns `null` for unparseable input so callers can keep their own fallback.
 */
export function parseDateParam(value: string, endOfDay: boolean): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (DATE_ONLY_RE.test(value)) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return endOfDay
      ? new Date(year, month, day, 23, 59, 59, 999)
      : new Date(year, month, day, 0, 0, 0, 0);
  }

  if (endOfDay && date.getTime() % 86_400_000 === 0) {
    return new Date(date.getTime() + 86_400_000 - 1);
  }

  return date;
}
