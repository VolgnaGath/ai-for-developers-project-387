import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { Slot } from '../../shared/api/bookings';
import { instantDateKey, msUntilNextMidnight } from '../../shared/date/timezone';

export function groupSlotsByDay(slots: Slot[], timezone: string): Map<string, Slot[]> {
  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = instantDateKey(slot.start, timezone);
    const list = byDay.get(key);
    if (list) list.push(slot);
    else byDay.set(key, [slot]);
  }
  return byDay;
}

/**
 * Задержка до ближайшего момента, когда ответ `listSlots` может измениться:
 * старт ближайшего будущего слота (слот станет начавшимся и пропадёт) или
 * ближайшая полночь в таймзоне конфига (окно бронирования сдвинется).
 * Старты в прошлом игнорируются.
 */
export function nextSlotsRefreshDelay(slots: Slot[], now: Dayjs): number {
  let delay = msUntilNextMidnight(now);
  const nowMs = now.valueOf();
  for (const slot of slots) {
    const diff = dayjs(slot.start).valueOf() - nowMs;
    if (diff > 0 && diff < delay) delay = diff;
  }
  return delay;
}
