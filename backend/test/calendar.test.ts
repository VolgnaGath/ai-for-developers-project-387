import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  type BusyInterval,
  instantDateKey,
  isBaseCandidateStart,
  isInstantInDateRange,
  listSlots,
} from "../src/calendar.ts";
import type { t_PublicConfig } from "../src/generated/models.ts";

function config(overrides: Partial<t_PublicConfig> = {}): t_PublicConfig {
  return {
    timezone: "Europe/Moscow",
    bookingWindowDays: 14,
    slotStepMinutes: 15,
    workingHours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
    ...overrides,
  };
}

const defaultConfig = config();
const monday = Temporal.PlainDate.from("2026-08-10");

function listDay(
  cfg: t_PublicConfig,
  date: Temporal.PlainDate,
  durationMinutes: number,
  now: Temporal.Instant,
  busy: BusyInterval[] = [],
) {
  const result = listSlots({
    config: cfg,
    durationMinutes,
    now,
    from: date.toString(),
    to: date.toString(),
    busy,
  });
  if (!result.ok) throw new Error(`unexpected ${result.reason}`);
  return result.slots;
}

describe("listSlots — сетка рабочего дня", () => {
  const now = Temporal.Instant.from("2026-08-10T06:00:00Z");

  it("нарезает 15-минутные слоты от начала рабочих часов", () => {
    const slots = listDay(defaultConfig, monday, 15, now);
    expect(slots).toHaveLength(36);
    expect(slots[0].start).toBe("2026-08-10T06:00:00Z");
    expect(slots[1].start).toBe("2026-08-10T06:15:00Z");
    expect(slots.at(-1)?.start).toBe("2026-08-10T14:45:00Z");
    expect(slots.at(-1)?.end).toBe("2026-08-10T15:00:00Z");
  });

  it("нарезает 30-минутные слоты с тем же шагом сетки", () => {
    const slots = listDay(defaultConfig, monday, 30, now);
    expect(slots).toHaveLength(35);
    expect(slots[0].start).toBe("2026-08-10T06:00:00Z");
    expect(slots.at(-1)?.start).toBe("2026-08-10T14:30:00Z");
    expect(slots.at(-1)?.end).toBe("2026-08-10T15:00:00Z");
  });

  it("не создаёт слоты до начала и после конца рабочих часов", () => {
    const slots = listDay(defaultConfig, monday, 15, now);
    const starts = new Set(slots.map((slot) => slot.start));
    expect(starts.has("2026-08-10T05:45:00Z")).toBe(false);
    expect(starts.has("2026-08-10T15:00:00Z")).toBe(false);
  });

  it("сериализует timestamps в UTC с Z", () => {
    const slots = listDay(defaultConfig, monday, 15, now);
    for (const slot of slots) {
      expect(slot.start.endsWith("Z")).toBe(true);
      expect(slot.end.endsWith("Z")).toBe(true);
    }
  });
});

describe("listSlots — выходные и будни", () => {
  const now = Temporal.Instant.from("2026-08-10T06:00:00Z");

  it("не возвращает слоты в субботу и воскресенье", () => {
    const saturday = Temporal.PlainDate.from("2026-08-15");
    const sunday = Temporal.PlainDate.from("2026-08-16");
    expect(listDay(defaultConfig, saturday, 15, now)).toHaveLength(0);
    expect(listDay(defaultConfig, sunday, 15, now)).toHaveLength(0);
  });

  it("возвращает слоты только за рабочие дни диапазона", () => {
    const result = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-14",
      to: "2026-08-17",
      busy: [],
    });
    if (!result.ok) throw new Error(`unexpected ${result.reason}`);
    const dates = result.slots.map((slot) => slot.start.slice(0, 10));
    expect(dates).toContain("2026-08-14");
    expect(dates).toContain("2026-08-17");
    expect(dates).not.toContain("2026-08-15");
    expect(dates).not.toContain("2026-08-16");
  });
});

describe("listSlots — окно бронирования", () => {
  const now = Temporal.Instant.from("2026-08-10T06:00:00Z");

  it("включает сегодня и последний день окна", () => {
    const result = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-10",
      to: "2026-08-23",
      busy: [],
    });
    if (!result.ok) throw new Error(`unexpected ${result.reason}`);
    const dates = new Set(result.slots.map((slot) => slot.start.slice(0, 10)));
    expect(dates.has("2026-08-10")).toBe(true);
    expect(dates.has("2026-08-21")).toBe(true);
    expect(dates.has("2026-08-23")).toBe(false);
  });

  it("возвращает пустой список для диапазона целиком вне окна", () => {
    const after = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-24",
      to: "2026-08-30",
      busy: [],
    });
    expect(after).toEqual({ ok: true, slots: [] });

    const before = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-01",
      to: "2026-08-05",
      busy: [],
    });
    expect(before).toEqual({ ok: true, slots: [] });
  });

  it("обрезает диапазон по началу окна", () => {
    const result = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-05",
      to: "2026-08-12",
      busy: [],
    });
    if (!result.ok) throw new Error(`unexpected ${result.reason}`);
    const dates = new Set(result.slots.map((slot) => slot.start.slice(0, 10)));
    expect(dates.has("2026-08-05")).toBe(false);
    expect(dates.has("2026-08-10")).toBe(true);
    expect(dates.has("2026-08-12")).toBe(true);
  });

  it("обрезает диапазон по концу окна", () => {
    const result = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-20",
      to: "2026-08-30",
      busy: [],
    });
    if (!result.ok) throw new Error(`unexpected ${result.reason}`);
    const dates = new Set(result.slots.map((slot) => slot.start.slice(0, 10)));
    expect(dates.has("2026-08-20")).toBe(true);
    expect(dates.has("2026-08-21")).toBe(true);
    expect(dates.has("2026-08-22")).toBe(false);
    expect(dates.has("2026-08-23")).toBe(false);
  });

  it("сообщает об ошибке при from > to", () => {
    const result = listSlots({
      config: defaultConfig,
      durationMinutes: 15,
      now,
      from: "2026-08-12",
      to: "2026-08-10",
      busy: [],
    });
    expect(result).toEqual({ ok: false, reason: "from_after_to" });
  });
});

describe("listSlots — прошедшие старты", () => {
  it("допускает старт ровно в now", () => {
    const now = Temporal.Instant.from("2026-08-10T06:00:00Z");
    const slots = listDay(defaultConfig, monday, 15, now);
    expect(slots[0].start).toBe("2026-08-10T06:00:00Z");
  });

  it("исключает старты раньше now", () => {
    const now = Temporal.Instant.from("2026-08-10T06:00:00.001Z");
    const slots = listDay(defaultConfig, monday, 15, now);
    expect(slots[0].start).toBe("2026-08-10T06:15:00Z");
  });

  it("исключает утренние слоты, когда день уже начался", () => {
    const now = Temporal.Instant.from("2026-08-10T07:00:00Z");
    const slots = listDay(defaultConfig, monday, 15, now);
    const starts = new Set(slots.map((slot) => slot.start));
    expect(starts.has("2026-08-10T06:45:00Z")).toBe(false);
    expect(starts.has("2026-08-10T07:00:00Z")).toBe(true);
  });

  it("не возвращает слоты прошедшего дня", () => {
    const now = Temporal.Instant.from("2026-08-10T16:00:00Z");
    expect(listDay(defaultConfig, monday, 15, now)).toHaveLength(0);
  });
});

describe("listSlots — DST", () => {
  it("пропускает несуществующие локальные старты при переходе вперёд", () => {
    const berlinGap = config({
      timezone: "Europe/Berlin",
      workingHours: { days: [7], start: "02:00", end: "04:00" },
    });
    const now = Temporal.Instant.from("2026-03-20T00:00:00Z");
    const slots = listDay(
      berlinGap,
      Temporal.PlainDate.from("2026-03-29"),
      15,
      now,
    );
    expect(slots.map((slot) => slot.start)).toEqual([
      "2026-03-29T01:00:00Z",
      "2026-03-29T01:15:00Z",
      "2026-03-29T01:30:00Z",
      "2026-03-29T01:45:00Z",
    ]);
  });

  it("сохраняет оба реальных момента повторённого локального времени", () => {
    const berlinRepeat = config({
      timezone: "Europe/Berlin",
      workingHours: { days: [7], start: "02:00", end: "03:00" },
    });
    const now = Temporal.Instant.from("2026-10-15T00:00:00Z");
    const slots = listDay(
      berlinRepeat,
      Temporal.PlainDate.from("2026-10-25"),
      15,
      now,
    );
    expect(slots.map((slot) => slot.start)).toEqual([
      "2026-10-25T00:00:00Z",
      "2026-10-25T01:00:00Z",
      "2026-10-25T00:15:00Z",
      "2026-10-25T01:15:00Z",
      "2026-10-25T00:30:00Z",
      "2026-10-25T01:30:00Z",
      "2026-10-25T00:45:00Z",
      "2026-10-25T01:45:00Z",
    ]);
  });
});

describe("listSlots — занятость", () => {
  const now = Temporal.Instant.from("2026-08-10T06:00:00Z");
  const busy: BusyInterval[] = [
    {
      start: Temporal.Instant.from("2026-08-10T07:00:00Z"),
      end: Temporal.Instant.from("2026-08-10T07:30:00Z"),
    },
  ];

  it("блокирует пересекающиеся 15-минутные слоты и оставляет смежные", () => {
    const slots = listDay(defaultConfig, monday, 15, now, busy);
    const starts = new Set(slots.map((slot) => slot.start));
    expect(starts.has("2026-08-10T07:00:00Z")).toBe(false);
    expect(starts.has("2026-08-10T07:15:00Z")).toBe(false);
    expect(starts.has("2026-08-10T06:45:00Z")).toBe(true);
    expect(starts.has("2026-08-10T07:30:00Z")).toBe(true);
  });

  it("блокирует пересекающиеся 30-минутные слоты", () => {
    const slots = listDay(defaultConfig, monday, 30, now, busy);
    const starts = new Set(slots.map((slot) => slot.start));
    expect(starts.has("2026-08-10T06:45:00Z")).toBe(false);
    expect(starts.has("2026-08-10T07:00:00Z")).toBe(false);
    expect(starts.has("2026-08-10T07:15:00Z")).toBe(false);
    expect(starts.has("2026-08-10T06:30:00Z")).toBe(true);
    expect(starts.has("2026-08-10T07:30:00Z")).toBe(true);
  });

  it("блокирует слоты разных длительностей одной занятостью", () => {
    const slots15 = listDay(defaultConfig, monday, 15, now, busy);
    const slots30 = listDay(defaultConfig, monday, 30, now, busy);
    for (const slots of [slots15, slots30]) {
      const starts = new Set(slots.map((slot) => slot.start));
      expect(starts.has("2026-08-10T07:00:00Z")).toBe(false);
      expect(starts.has("2026-08-10T07:30:00Z")).toBe(true);
    }
  });
});

describe("isBaseCandidateStart", () => {
  const now = Temporal.Instant.from("2026-08-10T06:00:00Z");
  const candidate = (start: Temporal.Instant, durationMinutes = 15) =>
    isBaseCandidateStart({
      config: defaultConfig,
      durationMinutes,
      now,
      start,
    });

  it("принимает корректный старт", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T06:00:00Z"))).toBe(true);
    expect(candidate(Temporal.Instant.from("2026-08-10T14:45:00Z"))).toBe(true);
  });

  it("принимает эквивалентные offsets", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T09:00:00+03:00"))).toBe(
      true,
    );
  });

  it("отклоняет секунды и миллисекунды", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T06:00:30Z"))).toBe(false);
    expect(candidate(Temporal.Instant.from("2026-08-10T06:00:00.500Z"))).toBe(
      false,
    );
  });

  it("отклоняет старты вне сетки", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T06:07:00Z"))).toBe(false);
  });

  it("отклоняет старты вне рабочих часов", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T05:45:00Z"))).toBe(false);
    expect(candidate(Temporal.Instant.from("2026-08-10T15:00:00Z"))).toBe(false);
  });

  it("учитывает длительность: 17:45 валиден для 15 минут и нет для 30", () => {
    const start = Temporal.Instant.from("2026-08-10T14:45:00Z");
    expect(candidate(start, 15)).toBe(true);
    expect(candidate(start, 30)).toBe(false);
  });

  it("отклоняет выходные", () => {
    expect(candidate(Temporal.Instant.from("2026-08-16T06:00:00Z"))).toBe(false);
  });

  it("допускает старт ровно в now и отклоняет прошедшие", () => {
    expect(candidate(Temporal.Instant.from("2026-08-10T06:00:00Z"))).toBe(true);
    const past = now.subtract({ nanoseconds: 1 });
    expect(candidate(past)).toBe(false);
  });

  it("отклоняет старты вне окна бронирования", () => {
    expect(candidate(Temporal.Instant.from("2026-08-24T06:00:00Z"))).toBe(false);
  });

  it("принимает оба момента повторённого локального времени при DST", () => {
    const berlinRepeat = config({
      timezone: "Europe/Berlin",
      workingHours: { days: [7], start: "02:00", end: "03:00" },
    });
    const now = Temporal.Instant.from("2026-10-15T00:00:00Z");
    const earlyInstant = Temporal.Instant.from("2026-10-25T00:30:00Z");
    const laterInstant = Temporal.Instant.from("2026-10-25T01:30:00Z");
    expect(
      isBaseCandidateStart({
        config: berlinRepeat,
        durationMinutes: 15,
        now,
        start: earlyInstant,
      }),
    ).toBe(true);
    expect(
      isBaseCandidateStart({
        config: berlinRepeat,
        durationMinutes: 15,
        now,
        start: laterInstant,
      }),
    ).toBe(true);
  });
});

describe("isInstantInDateRange / instantDateKey", () => {
  const evening = Temporal.Instant.from("2026-08-06T21:30:00Z");

  it("вычисляет календарную дату в таймзоне конфига", () => {
    expect(instantDateKey(evening, "Europe/Moscow")).toBe("2026-08-07");
    expect(instantDateKey(evening, "UTC")).toBe("2026-08-06");
  });

  it("фильтрует включительно по началу диапазона", () => {
    expect(isInstantInDateRange(evening, "Europe/Moscow", "2026-08-07")).toBe(
      true,
    );
    expect(isInstantInDateRange(evening, "Europe/Moscow", "2026-08-08")).toBe(
      false,
    );
  });

  it("фильтрует включительно по концу диапазона", () => {
    expect(
      isInstantInDateRange(evening, "Europe/Moscow", undefined, "2026-08-07"),
    ).toBe(true);
    expect(
      isInstantInDateRange(evening, "Europe/Moscow", undefined, "2026-08-06"),
    ).toBe(false);
  });

  it("включает обе границы", () => {
    expect(
      isInstantInDateRange(evening, "Europe/Moscow", "2026-08-07", "2026-08-07"),
    ).toBe(true);
    expect(
      isInstantInDateRange(evening, "Europe/Moscow", "2026-08-06", "2026-08-06"),
    ).toBe(false);
  });

  it("без границ возвращает истину", () => {
    expect(isInstantInDateRange(evening, "Europe/Moscow")).toBe(true);
  });
});
