import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slot } from '../../shared/api/bookings';
import { nowInZone } from '../../shared/date/timezone';
import { groupSlotsByDay, nextSlotsRefreshDelay } from './slots';

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

describe('nextSlotsRefreshDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the delay until the earliest future slot start when it precedes midnight', () => {
    const now = nowInZone('UTC');
    const slots = [
      slot('2026-08-06T12:15:00Z', '2026-08-06T12:45:00Z'),
      slot('2026-08-06T13:00:00Z', '2026-08-06T13:30:00Z'),
    ];
    expect(nextSlotsRefreshDelay(slots, now)).toBe(15 * 60 * 1000);
  });

  it('falls back to the next midnight when there are no upcoming slots', () => {
    const now = nowInZone('UTC');
    expect(nextSlotsRefreshDelay([], now)).toBe(12 * 60 * 60 * 1000);
  });

  it('ignores slots that already started', () => {
    const now = nowInZone('UTC');
    const slots = [
      slot('2026-08-06T11:30:00Z', '2026-08-06T12:00:00Z'),
      slot('2026-08-06T12:30:00Z', '2026-08-06T13:00:00Z'),
    ];
    expect(nextSlotsRefreshDelay(slots, now)).toBe(30 * 60 * 1000);
  });

  it('computes the midnight fallback in the config timezone, not the browser timezone', () => {
    vi.setSystemTime(new Date('2026-08-06T21:30:00Z'));
    const now = nowInZone('Europe/Moscow');
    expect(now.format('YYYY-MM-DD HH:mm')).toBe('2026-08-07 00:30');
    expect(nextSlotsRefreshDelay([], now)).toBe(23.5 * 60 * 60 * 1000);
  });
});
