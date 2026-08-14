import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import 'dayjs/locale/ru.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ru');

export type { Dayjs };

export function nowInZone(timezone: string): Dayjs {
  return dayjs().tz(timezone);
}

export function todayInZone(timezone: string): Dayjs {
  return nowInZone(timezone).startOf('day');
}

export function msUntilNextMidnight(now: Dayjs): number {
  return now.add(1, 'day').startOf('day').valueOf() - now.valueOf();
}

export function parsePlainDate(value: string, timezone: string): Dayjs {
  return dayjs.tz(value, timezone).startOf('day');
}

export function plainDateKey(day: Dayjs): string {
  return day.format('YYYY-MM-DD');
}

export function instantDateKey(iso: string, timezone: string): string {
  return dayjs(iso).tz(timezone).startOf('day').format('YYYY-MM-DD');
}

export function isValidPlainDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayjs.tz(value, 'UTC');
  return parsed.isValid() && parsed.format('YYYY-MM-DD') === value;
}

export function isInWindow(day: Dayjs, timezone: string, windowDays: number): boolean {
  const diff = day.startOf('day').diff(todayInZone(timezone), 'day');
  return diff >= 0 && diff < windowDays;
}

export function canGoForward(month: string, timezone: string, windowDays: number): boolean {
  const nextMonthStart = parsePlainDate(month, timezone).add(1, 'month').startOf('month');
  const lastWindowDay = todayInZone(timezone).add(windowDays - 1, 'day');
  return nextMonthStart.diff(lastWindowDay, 'day') <= 0;
}

export function visibleGridRange(month: string, timezone: string): { from: string; to: string } {
  const first = parsePlainDate(month, timezone).startOf('month');
  const gridStart = first.subtract((first.day() + 6) % 7, 'day');
  const last = first.endOf('month');
  const gridEnd = last.add((7 - last.day()) % 7, 'day');
  return { from: plainDateKey(gridStart), to: plainDateKey(gridEnd) };
}

export function formatTime(iso: string, timezone: string): string {
  return dayjs(iso).tz(timezone).format('HH:mm');
}

export function formatDateTime(iso: string, timezone: string): string {
  return dayjs(iso).tz(timezone).format('D MMMM YYYY, HH:mm');
}

export function formatMonthLabel(month: string): string {
  const label = dayjs.tz(`${month.slice(0, 7)}-01`, 'UTC').format('MMMM YYYY');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function weekdayLabel(date: string, timezone: string): string {
  return parsePlainDate(date, timezone).format('dddd');
}
