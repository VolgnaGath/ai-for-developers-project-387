import type { Slot } from '../../shared/api/bookings';
import { instantDateKey } from '../../shared/date/timezone';

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
