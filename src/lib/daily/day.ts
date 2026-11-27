import { SCORING } from "@/config/scoring";
import {
  dayKeyInTimeZone,
  shiftDayKey,
  weekStartKey,
  zonedDayBounds,
} from "@/lib/time/zone";

export const DAILY_TIME_ZONE = SCORING.timeZone;

export function dailyGameDate(now: Date, timeZone = DAILY_TIME_ZONE): string {
  return dayKeyInTimeZone(now, timeZone);
}

export function nextDailyStart(now: Date, timeZone = DAILY_TIME_ZONE): Date | null {
  const bounds = zonedDayBounds(dailyGameDate(now, timeZone), timeZone);
  return bounds?.end ?? null;
}

/** Monday–Sunday game dates containing `now`, in the daily time zone. */
export function dailyWeekRange(
  now: Date,
  timeZone = DAILY_TIME_ZONE,
): { start: string; end: string } | null {
  const day = dailyGameDate(now, timeZone);
  const start = weekStartKey(day);
  if (!start) return null;
  const end = shiftDayKey(start, 6);
  if (!end) return null;
  return { start, end };
}

export function repeatCutoff(gameDate: string, windowDays: number): string | null {
  return shiftDayKey(gameDate, -windowDays);
}

export function formatGameDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
