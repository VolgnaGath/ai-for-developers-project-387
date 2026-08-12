import { Temporal } from "@js-temporal/polyfill";
import type { t_PublicConfig, t_Slot } from "./generated/models.ts";

export interface BusyInterval {
  start: Temporal.Instant;
  end: Temporal.Instant;
}

export interface ListSlotsQuery {
  config: t_PublicConfig;
  durationMinutes: number;
  now: Temporal.Instant;
  /** Включительная календарная дата в таймзоне конфига, "YYYY-MM-DD". */
  from: string;
  /** Включительная календарная дата в таймзоне конфига, "YYYY-MM-DD". */
  to: string;
  busy: readonly BusyInterval[];
}

export type ListSlotsResult =
  | { ok: true; slots: t_Slot[] }
  | { ok: false; reason: "from_after_to" };

export interface CandidateQuery {
  config: t_PublicConfig;
  durationMinutes: number;
  now: Temporal.Instant;
  start: Temporal.Instant;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(
  start: Temporal.Instant,
  end: Temporal.Instant,
  otherStart: Temporal.Instant,
  otherEnd: Temporal.Instant,
): boolean {
  return (
    Temporal.Instant.compare(start, otherEnd) < 0 &&
    Temporal.Instant.compare(otherStart, end) < 0
  );
}

/**
 * Базовые кандидаты одного календарного дня: локальные старты от
 * `workingHours.start` с шагом `slotStepMinutes`, полностью помещающиеся
 * в рабочие часы. Пропущенные локальные времена при DST не дают инстантов;
 * при повторе сохраняются оба реальных момента. Результат упорядочен по
 * возрастанию локального времени, повторённые времена — подряд.
 */
function candidatesForDay(
  config: t_PublicConfig,
  date: Temporal.PlainDate,
  durationMinutes: number,
): Temporal.Instant[] {
  const gridStart = toMinutes(config.workingHours.start);
  const gridEnd = toMinutes(config.workingHours.end);
  const step = config.slotStepMinutes;

  const candidates: Temporal.Instant[] = [];
  for (
    let minute = gridStart;
    minute + durationMinutes <= gridEnd;
    minute += step
  ) {
    const local = date.toPlainDateTime({
      hour: Math.floor(minute / 60),
      minute: minute % 60,
    });
    for (const disambiguation of ["earlier", "later"] as const) {
      const resolved = local.toZonedDateTime(config.timezone, {
        disambiguation,
      });
      if (!resolved.toPlainDateTime().equals(local)) continue;
      candidates.push(resolved.toInstant());
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function listSlots(query: ListSlotsQuery): ListSlotsResult {
  const { config, now } = query;
  const timezone = config.timezone;

  const fromDate = Temporal.PlainDate.from(query.from);
  const toDate = Temporal.PlainDate.from(query.to);
  if (Temporal.PlainDate.compare(fromDate, toDate) > 0) {
    return { ok: false, reason: "from_after_to" };
  }

  const today = now.toZonedDateTimeISO(timezone).toPlainDate();
  const lastWindowDay = today.add({ days: config.bookingWindowDays - 1 });

  const startDate =
    Temporal.PlainDate.compare(fromDate, today) < 0 ? today : fromDate;
  const endDate =
    Temporal.PlainDate.compare(toDate, lastWindowDay) > 0
      ? lastWindowDay
      : toDate;
  if (Temporal.PlainDate.compare(startDate, endDate) > 0) {
    return { ok: true, slots: [] };
  }

  const slots: t_Slot[] = [];
  for (
    let date = startDate;
    Temporal.PlainDate.compare(date, endDate) <= 0;
    date = date.add({ days: 1 })
  ) {
    if (!config.workingHours.days.includes(date.dayOfWeek)) continue;

    for (const start of candidatesForDay(config, date, query.durationMinutes)) {
      if (Temporal.Instant.compare(start, now) < 0) continue;

      const end = start.add({ minutes: query.durationMinutes });
      const busy = query.busy.some((interval) =>
        overlaps(start, end, interval.start, interval.end),
      );
      if (busy) continue;

      slots.push({ start: start.toString(), end: end.toString() });
    }
  }

  return { ok: true, slots };
}

/**
 * Корректен ли входной `start` как базовый кандидат без учёта занятости:
 * совпадает с сеткой, целиком помещается в рабочие часы, лежит в окне
 * бронирования и не в прошлом. Эквивалентные offsets принимаются; произвольные
 * секунды и миллисекунды делают старт невалидным.
 */
export function isBaseCandidateStart(query: CandidateQuery): boolean {
  const { config, now, start } = query;

  if (Temporal.Instant.compare(start, now) < 0) return false;

  const local = start.toZonedDateTimeISO(config.timezone).toPlainDateTime();

  if (!config.workingHours.days.includes(local.dayOfWeek)) return false;
  if (
    local.second !== 0 ||
    local.millisecond !== 0 ||
    local.microsecond !== 0 ||
    local.nanosecond !== 0
  ) {
    return false;
  }

  const minute = local.hour * 60 + local.minute;
  const gridStart = toMinutes(config.workingHours.start);
  const gridEnd = toMinutes(config.workingHours.end);
  if (minute < gridStart || minute + query.durationMinutes > gridEnd) {
    return false;
  }
  if ((minute - gridStart) % config.slotStepMinutes !== 0) return false;

  const date = local.toPlainDate();
  const today = now.toZonedDateTimeISO(config.timezone).toPlainDate();
  const lastWindowDay = today.add({ days: config.bookingWindowDays - 1 });
  return (
    Temporal.PlainDate.compare(date, today) >= 0 &&
    Temporal.PlainDate.compare(date, lastWindowDay) <= 0
  );
}

/** Календарная дата инстанта в заданной таймзоне, "YYYY-MM-DD". */
export function instantDateKey(
  instant: Temporal.Instant,
  timezone: string,
): string {
  return instant.toZonedDateTimeISO(timezone).toPlainDate().toString();
}

/**
 * Попадает ли инстант во включительный диапазон календарных дат
 * `[from, to]` в заданной таймзоне. `from` и `to` опциональны: без границ
 * результат истинен, одна граница фильтрует только с неё.
 */
export function isInstantInDateRange(
  instant: Temporal.Instant,
  timezone: string,
  from?: string,
  to?: string,
): boolean {
  const date = instantDateKey(instant, timezone);
  if (from !== undefined && date < from) return false;
  if (to !== undefined && date > to) return false;
  return true;
}
