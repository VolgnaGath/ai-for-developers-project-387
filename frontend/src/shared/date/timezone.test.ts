import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canGoForward,
  configDayOfWeek,
  formatDateTime,
  formatMonthLabel,
  formatTime,
  instantDateKey,
  isInWindow,
  isValidPlainDate,
  msUntilNextMidnight,
  nowInZone,
  parsePlainDate,
  plainDateKey,
  todayInZone,
  visibleGridRange,
  weekdayLabel,
} from './timezone';

const WINDOW_DAYS = 14;

describe('nowInZone / todayInZone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T21:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns wall-clock now in the target timezone', () => {
    expect(nowInZone('Europe/Moscow').format('YYYY-MM-DD HH:mm')).toBe('2026-08-07 00:30');
    expect(nowInZone('America/New_York').format('YYYY-MM-DD HH:mm')).toBe('2026-08-06 17:30');
  });

  it('returns start of today in the target timezone', () => {
    expect(todayInZone('Europe/Moscow').format('YYYY-MM-DD HH:mm')).toBe('2026-08-07 00:00');
    expect(todayInZone('America/New_York').format('YYYY-MM-DD HH:mm')).toBe('2026-08-06 00:00');
  });
});

describe('parsePlainDate / plainDateKey', () => {
  it('parses a calendar date as midnight in the target timezone', () => {
    const day = parsePlainDate('2026-08-06', 'Europe/Moscow');
    expect(day.format('YYYY-MM-DD HH:mm')).toBe('2026-08-06 00:00');
    expect(day.utc().format('YYYY-MM-DD HH:mm')).toBe('2026-08-05 21:00');
  });

  it('returns the YYYY-MM-DD key', () => {
    const day = parsePlainDate('2026-08-06', 'UTC');
    expect(plainDateKey(day)).toBe('2026-08-06');
  });
});

describe('configDayOfWeek', () => {
  it('maps dayjs weekdays to config numbering (1 = Пн … 7 = Вс)', () => {
    expect(configDayOfWeek(parsePlainDate('2026-08-10', 'UTC'))).toBe(1);
    expect(configDayOfWeek(parsePlainDate('2026-08-08', 'UTC'))).toBe(6);
    expect(configDayOfWeek(parsePlainDate('2026-08-09', 'UTC'))).toBe(7);
  });
});

describe('instantDateKey', () => {
  it('converts a UTC instant to the calendar date in the target timezone', () => {
    expect(instantDateKey('2026-08-06T21:30:00Z', 'Europe/Moscow')).toBe('2026-08-07');
    expect(instantDateKey('2026-08-06T09:00:00Z', 'Europe/Moscow')).toBe('2026-08-06');
    expect(instantDateKey('2026-08-06T21:30:00Z', 'UTC')).toBe('2026-08-06');
  });
});

describe('isValidPlainDate', () => {
  it('accepts valid dates', () => {
    expect(isValidPlainDate('2026-08-06')).toBe(true);
    expect(isValidPlainDate('2026-02-28')).toBe(true);
  });

  it('rejects malformed and rolled-over dates', () => {
    expect(isValidPlainDate('2026-8-6')).toBe(false);
    expect(isValidPlainDate('2026-13-01')).toBe(false);
    expect(isValidPlainDate('2026-02-30')).toBe(false);
    expect(isValidPlainDate('08-06-2026')).toBe(false);
    expect(isValidPlainDate('2026/08/06')).toBe(false);
    expect(isValidPlainDate('abcd')).toBe(false);
  });
});

describe('isInWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes today and the last window day', () => {
    expect(isInWindow(parsePlainDate('2026-08-06', 'UTC'), 'UTC', WINDOW_DAYS)).toBe(true);
    expect(isInWindow(parsePlainDate('2026-08-19', 'UTC'), 'UTC', WINDOW_DAYS)).toBe(true);
  });

  it('excludes the day after the window and past days', () => {
    expect(isInWindow(parsePlainDate('2026-08-20', 'UTC'), 'UTC', WINDOW_DAYS)).toBe(false);
    expect(isInWindow(parsePlainDate('2026-08-05', 'UTC'), 'UTC', WINDOW_DAYS)).toBe(false);
  });
});

describe('canGoForward', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows months that still intersect the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
    expect(canGoForward('2026-07-01', 'UTC', WINDOW_DAYS)).toBe(true);
  });

  it('blocks months fully beyond the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
    expect(canGoForward('2026-08-01', 'UTC', WINDOW_DAYS)).toBe(false);
  });

  it('allows the boundary month that starts exactly on the last window day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00Z'));
    expect(canGoForward('2026-07-01', 'UTC', WINDOW_DAYS)).toBe(true);
  });
});

describe('visibleGridRange', () => {
  it('spans a Monday-to-Sunday grid around the month', () => {
    expect(visibleGridRange('2026-08-01', 'UTC')).toEqual({
      from: '2026-07-27',
      to: '2026-09-06',
    });
    expect(visibleGridRange('2026-02-01', 'UTC')).toEqual({
      from: '2026-01-26',
      to: '2026-03-01',
    });
    expect(visibleGridRange('2026-05-01', 'UTC')).toEqual({
      from: '2026-04-27',
      to: '2026-05-31',
    });
  });

  it('ends on a Sunday regardless of the last day of the month', () => {
    for (const month of ['2026-01-01', '2026-02-01', '2026-05-01', '2026-08-01', '2026-12-01']) {
      const { to } = visibleGridRange(month, 'UTC');
      expect(parsePlainDate(to, 'UTC').format('dddd')).toBe('воскресенье');
    }
  });

  it('does not depend on the calendar timezone offset', () => {
    expect(visibleGridRange('2026-08-01', 'Europe/Moscow')).toEqual({
      from: '2026-07-27',
      to: '2026-09-06',
    });
  });
});

describe('msUntilNextMidnight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T21:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the time until midnight in the zone of the given instant', () => {
    expect(msUntilNextMidnight(nowInZone('Europe/Moscow'))).toBe(
      24 * 60 * 60 * 1000 - 30 * 60 * 1000,
    );
  });

  it('is zero at the start of a day', () => {
    expect(msUntilNextMidnight(todayInZone('UTC'))).toBe(24 * 60 * 60 * 1000);
  });

  it('depends on the target timezone, not the browser time', () => {
    const utc = msUntilNextMidnight(nowInZone('UTC'));
    const moscow = msUntilNextMidnight(nowInZone('Europe/Moscow'));
    expect(utc).not.toBe(moscow);
  });
});

describe('formatting', () => {
  it('formats time in the target timezone', () => {
    expect(formatTime('2026-08-06T12:00:00Z', 'Europe/Moscow')).toBe('15:00');
  });

  it('formats date and time in Russian', () => {
    expect(formatDateTime('2026-08-06T12:00:00Z', 'Europe/Moscow')).toBe(
      '6 августа 2026, 15:00',
    );
  });

  it('formats the month label capitalized', () => {
    expect(formatMonthLabel('2026-08-01')).toBe('Август 2026');
  });

  it('formats a Russian weekday label', () => {
    expect(weekdayLabel('2026-08-06', 'UTC')).toBe('четверг');
  });
});
