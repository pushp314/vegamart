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
