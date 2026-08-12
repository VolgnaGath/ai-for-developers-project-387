import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { PublicConfig } from '../../shared/api/bookings';
import { isBaseCandidateStart, listSlots } from './calendar';

const CONFIG: PublicConfig = {
  timezone: 'Europe/Moscow',
  bookingWindowDays: 14,
  slotStepMinutes: 15,
  workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
};

// Понедельник 2026-08-10; окно бронирования — 10.08..23.08.
const MONDAY_LOCAL_09 = dayjs('2026-08-10T06:00:00Z');

function localSlotKey(iso: string, durationMinutes: number): string {
  const start = dayjs(iso).tz(CONFIG.timezone).format('YYYY-MM-DD HH:mm');
  const end = dayjs(iso).tz(CONFIG.timezone).add(durationMinutes, 'minute').format('HH:mm');
  return `${start}–${end}`;
}

describe('listSlots (mock calendar)', () => {
  it('возвращает from > to как ошибку', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-11',
      to: '2026-08-10',
      busy: [],
    });
    expect(result).toEqual({ ok: false, reason: 'from_after_to' });
  });

  it('диапазон `to` включительный: слоты есть и на последнюю дату', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-10',
      to: '2026-08-11',
      busy: [],
    });
    expect(result.ok).toBe(true);
    const keys = (result.ok ? result.slots : []).map((slot) => slot.start);
    expect(keys.some((iso) => dayjs(iso).tz(CONFIG.timezone).format('YYYY-MM-DD') === '2026-08-11')).toBe(true);
  });

  it('сетка идёт от workingHours.start с шагом slotStepMinutes и полностью влезает в рабочие часы', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-10',
      to: '2026-08-10',
      busy: [],
    });
    expect(result.ok).toBe(true);
    const slots = result.ok ? result.slots : [];
    const keys = slots.map((slot) => localSlotKey(slot.start, 30));
    expect(keys[0]).toBe('2026-08-10 09:00–09:30');
    expect(keys[1]).toBe('2026-08-10 09:15–09:45');
    expect(keys).toContain('2026-08-10 17:30–18:00');
    expect(keys).not.toContain('2026-08-10 18:00–18:30');
  });

  it('пропускает выходные', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-15',
      to: '2026-08-16',
      busy: [],
    });
    expect(result).toEqual({ ok: true, slots: [] });
  });

  it('старт ровно в now допустим, более ранние старты исключены', () => {
    const now = dayjs('2026-08-10T06:30:00Z'); // локально 09:30
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now,
      from: '2026-08-10',
      to: '2026-08-10',
      busy: [],
    });
    expect(result.ok).toBe(true);
    const keys = (result.ok ? result.slots : []).map((slot) => localSlotKey(slot.start, 30));
    expect(keys[0]).toBe('2026-08-10 09:30–10:00');
    expect(keys).not.toContain('2026-08-10 09:15–09:45');
  });

  it('диапазон целиком вне окна бронирования возвращает пустой список', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-24',
      to: '2026-08-30',
      busy: [],
    });
    expect(result).toEqual({ ok: true, slots: [] });
  });

  it('диапазон, начинающийся раньше окна, обрезается до «сегодня»', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-07-01',
      to: '2026-08-11',
      busy: [],
    });
    expect(result.ok).toBe(true);
    const dates = new Set(
      (result.ok ? result.slots : []).map((slot) => dayjs(slot.start).tz(CONFIG.timezone).format('YYYY-MM-DD')),
    );
    expect(dates.has('2026-08-10')).toBe(true);
    expect(dates.has('2026-08-11')).toBe(true);
    expect(dates.has('2026-07-01')).toBe(false);
  });

  it('бронь блокирует пересекающиеся слоты и не трогает смежные', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-10',
      to: '2026-08-10',
      busy: [{ start: '2026-08-10T06:00:00Z', end: '2026-08-10T06:30:00Z' }], // 09:00–09:30
    });
    expect(result.ok).toBe(true);
    const keys = (result.ok ? result.slots : []).map((slot) => localSlotKey(slot.start, 30));
    expect(keys).not.toContain('2026-08-10 09:00–09:30');
    expect(keys).not.toContain('2026-08-10 09:15–09:45');
    expect(keys).toContain('2026-08-10 09:30–10:00');
  });

  it('занятость общая между типами событий (разные длительности)', () => {
    const result = listSlots({
      config: CONFIG,
      durationMinutes: 30,
      now: MONDAY_LOCAL_09,
      from: '2026-08-10',
      to: '2026-08-10',
      busy: [{ start: '2026-08-10T06:00:00Z', end: '2026-08-10T06:15:00Z' }], // онбординг 09:00–09:15
    });
    expect(result.ok).toBe(true);
    const keys = (result.ok ? result.slots : []).map((slot) => localSlotKey(slot.start, 30));
    expect(keys).not.toContain('2026-08-10 09:00–09:30');
    expect(keys).toContain('2026-08-10 09:15–09:45');
  });
});

describe('isBaseCandidateStart', () => {
  it('принимает старт, совпадающий с кандидатом', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-10T06:00:00+00:00',
      }),
    ).toBe(true);
  });

  it('принимает эквивалентный offset', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-10T09:00:00+03:00',
      }),
    ).toBe(true);
  });

  it('отклоняет старт вне сетки', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-10T09:07:00Z',
      }),
    ).toBe(false);
  });

  it('отклоняет старт с секундами', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-10T06:00:30Z',
      }),
    ).toBe(false);
  });

  it('отклоняет старт в прошлом и принимает ровно now', () => {
    const now = dayjs('2026-08-10T06:30:00Z');
    expect(
      isBaseCandidateStart({ config: CONFIG, durationMinutes: 30, now, start: '2026-08-10T06:00:00Z' }),
    ).toBe(false);
    expect(
      isBaseCandidateStart({ config: CONFIG, durationMinutes: 30, now, start: '2026-08-10T06:30:00Z' }),
    ).toBe(true);
  });

  it('отклоняет слот, не помещающийся в рабочие часы', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-10T15:00:00Z', // локально 18:00
      }),
    ).toBe(false);
  });

  it('отклоняет выходной день', () => {
    expect(
      isBaseCandidateStart({
        config: CONFIG,
        durationMinutes: 30,
        now: MONDAY_LOCAL_09,
        start: '2026-08-15T06:00:00Z',
      }),
    ).toBe(false);
  });
});
