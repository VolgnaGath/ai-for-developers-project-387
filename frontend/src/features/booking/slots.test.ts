import { describe, expect, it } from 'vitest';
import type { Slot } from '../../shared/api/bookings';
import { groupSlotsByDay } from './slots';

function slot(start: string, end: string): Slot {
  return { start, end };
}

describe('groupSlotsByDay', () => {
  it('groups UTC slots by the calendar date in the config timezone', () => {
    const slots = [
      slot('2026-08-06T12:00:00Z', '2026-08-06T12:30:00Z'),
      slot('2026-08-06T13:00:00Z', '2026-08-06T13:30:00Z'),
      slot('2026-08-07T12:00:00Z', '2026-08-07T12:30:00Z'),
    ];
    const byDay = groupSlotsByDay(slots, 'UTC');
    expect(byDay.size).toBe(2);
    expect(byDay.get('2026-08-06')).toHaveLength(2);
    expect(byDay.get('2026-08-07')).toHaveLength(1);
  });

  it('places a slot on the next calendar day when the timezone crosses midnight', () => {
    const slots = [slot('2026-08-06T21:30:00Z', '2026-08-06T22:00:00Z')];
    const byDay = groupSlotsByDay(slots, 'Europe/Moscow');
    expect(byDay.get('2026-08-07')).toHaveLength(1);
    expect(byDay.has('2026-08-06')).toBe(false);
  });

  it('returns an empty map for no slots', () => {
    expect(groupSlotsByDay([], 'UTC').size).toBe(0);
  });
});
