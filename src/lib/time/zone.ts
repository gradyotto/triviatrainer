const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function resolveTimeZone(
  timeZone: string | null | undefined,
): string | null {
  if (!timeZone) return null;
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed.length > 64) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}

export function normalizeTimeZone(
  timeZone: string | null | undefined,
): string {
  return resolveTimeZone(timeZone) ?? "UTC";
}

export function browserTimeZone(): string | undefined {
  return resolveTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) ?? undefined;
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function dayKeyInTimeZone(value: Date, timeZone: string): string {
  const zone = normalizeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

export function shiftDayKey(day: string, delta: number): string | null {
  const match = DAY.exec(day);
  if (!match || !Number.isInteger(delta)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    return null;
  }
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  let hour = Number(part(parts, "hour"));
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(part(parts, "year")),
    Number(part(parts, "month")) - 1,
    Number(part(parts, "day")),
    hour,
    Number(part(parts, "minute")),
    Number(part(parts, "second")),
  );
  return asUtc - instant.getTime();
}

function zonedMidnight(dayKey: string, timeZone: string): number | null {
  const match = DAY.exec(dayKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, date, 0, 0, 0);
  const first = utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone);
  return utcMidnight - timeZoneOffsetMs(new Date(first), timeZone);
}

/** Inclusive start and exclusive end of a calendar day in an IANA time zone. */
export function zonedDayBounds(
  dayKey: string,
  timeZone: string,
): { start: Date; end: Date } | null {
  const zone = normalizeTimeZone(timeZone);
  const start = zonedMidnight(dayKey, zone);
  const next = shiftDayKey(dayKey, 1);
  if (start == null || !next) return null;
  const end = zonedMidnight(next, zone);
  if (end == null || end <= start) return null;
  return { start: new Date(start), end: new Date(end) };
}

export function weekStartKey(dayKey: string): string | null {
  const match = DAY.exec(dayKey);
  if (!match) return null;
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  return shiftDayKey(dayKey, -delta);
}

export function eachDayKey(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor: string | null = start;
  while (cursor && cursor <= end && days.length < 4000) {
    days.push(cursor);
    cursor = shiftDayKey(cursor, 1);
  }
  return days;
}
