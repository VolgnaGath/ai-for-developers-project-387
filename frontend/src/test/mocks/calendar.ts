import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { PublicConfig, Slot } from '../../shared/api/bookings';
import { configDayOfWeek, parsePlainDate, plainDateKey } from '../../shared/date/timezone';

export interface BusyInterval {
  start: string;
  end: string;
}

export interface ListSlotsQuery {
  config: PublicConfig;
  durationMinutes: number;
  /** Текущий момент в таймзоне конфига; старт ровно в `now` допустим. */
  now: Dayjs;
  /** Включительная календарная дата в таймзоне конфига, "YYYY-MM-DD". */
  from: string;
  /** Включительная календарная дата в таймзоне конфига, "YYYY-MM-DD". */
  to: string;
  busy: readonly BusyInterval[];
}

export type ListSlotsResult =
  | { ok: true; slots: Slot[] }
  | { ok: false; reason: 'from_after_to' };

export interface CandidateQuery {
  config: PublicConfig;
  durationMinutes: number;
  now: Dayjs;
  /** Входной старт как ISO timestamp с любым корректным offset. */
  start: string;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
): boolean {
  return (
    dayjs(start).valueOf() < dayjs(otherEnd).valueOf() &&
    dayjs(otherStart).valueOf() < dayjs(end).valueOf()
  );
}

/**
 * Зеркало бэкендной календарной логики: включительный диапазон дат
 * `[from, to]` в таймзоне конфига, сетка от `workingHours.start` с шагом
 * `slotStepMinutes`, полное влезание по длительности, только рабочие дни,
 * кламп окна бронирования (сегодня и следующие 13 дат), исключение
 * прошедших стартов и пересечений с любой бронью (общая занятость).
 */
export function listSlots(query: ListSlotsQuery): ListSlotsResult {
  const { config, now } = query;
  const timezone = config.timezone;

  const fromDate = parsePlainDate(query.from, timezone);
  const toDate = parsePlainDate(query.to, timezone);
  if (fromDate.isAfter(toDate, 'day')) {
    return { ok: false, reason: 'from_after_to' };
  }

  const today = now.tz(timezone).startOf('day');
  const lastWindowDay = today.add(config.bookingWindowDays - 1, 'day');

  const startDate = fromDate.isBefore(today, 'day') ? today : fromDate;
  const endDate = toDate.isAfter(lastWindowDay, 'day') ? lastWindowDay : toDate;
  if (startDate.isAfter(endDate, 'day')) {
    return { ok: true, slots: [] };
  }

  const gridStart = toMinutes(config.workingHours.start);
  const gridEnd = toMinutes(config.workingHours.end);
  const step = config.slotStepMinutes;
  const nowMs = now.valueOf();

  const slots: Slot[] = [];
    for (
      let day = startDate;
      day.isBefore(endDate, 'day') || day.isSame(endDate, 'day');
      day = day.add(1, 'day')
    ) {
      if (!config.workingHours.days.includes(configDayOfWeek(day))) continue;

    for (let minute = gridStart; minute + query.durationMinutes <= gridEnd; minute += step) {
      const start = day.hour(Math.floor(minute / 60)).minute(minute % 60).second(0).millisecond(0);
      if (start.valueOf() < nowMs) continue;

      const end = start.add(query.durationMinutes, 'minute');
      const busy = query.busy.some((interval) =>
        overlaps(start.toISOString(), end.toISOString(), interval.start, interval.end),
      );
      if (busy) continue;

      slots.push({ start: start.toISOString(), end: end.toISOString() });
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
  if (dayjs(start).valueOf() < now.valueOf()) return false;

  const local = dayjs(start).tz(config.timezone);
  if (local.second() !== 0 || local.millisecond() !== 0) return false;

  if (!config.workingHours.days.includes(configDayOfWeek(local))) return false;

  const minute = local.hour() * 60 + local.minute();
  const gridStart = toMinutes(config.workingHours.start);
  const gridEnd = toMinutes(config.workingHours.end);
  if (minute < gridStart || minute + query.durationMinutes > gridEnd) return false;
  if ((minute - gridStart) % config.slotStepMinutes !== 0) return false;

  const today = now.tz(config.timezone).startOf('day');
  const lastWindowDay = today.add(config.bookingWindowDays - 1, 'day');
  const date = local.format('YYYY-MM-DD');
  return date >= plainDateKey(today) && date <= plainDateKey(lastWindowDay);
}
