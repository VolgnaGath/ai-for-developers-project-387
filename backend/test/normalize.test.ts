import { describe, expect, it } from "vitest";
import {
  normalizeBookingInput,
  normalizeEventTypeInput,
} from "../src/normalize.ts";

describe("normalizeEventTypeInput", () => {
  it("обрезает внешние пробелы у title и description", () => {
    const result = normalizeEventTypeInput({
      title: "  Консультация  ",
      description: "  Текст  ",
      durationMinutes: 30,
    });
    expect(result).toEqual({
      ok: true,
      value: { title: "Консультация", description: "Текст", durationMinutes: 30 },
    });
  });

  it("отклоняет title из одних пробелов", () => {
    expect(
      normalizeEventTypeInput({ title: "   ", durationMinutes: 15 }),
    ).toEqual({ ok: false });
  });

  it("преобразует пустую после trim description в отсутствие поля", () => {
    expect(
      normalizeEventTypeInput({
        title: "Тип",
        description: "   ",
        durationMinutes: 15,
      }),
    ).toEqual({ ok: true, value: { title: "Тип", durationMinutes: 15 } });
  });

  it("сохраняет отсутствие description", () => {
    expect(
      normalizeEventTypeInput({ title: "Тип", durationMinutes: 15 }),
    ).toEqual({ ok: true, value: { title: "Тип", durationMinutes: 15 } });
  });
});

describe("normalizeBookingInput", () => {
  it("обрезает guestName и guestEmail", () => {
    const result = normalizeBookingInput({
      eventTypeId: "evt_1",
      start: "2026-08-10T06:00:00Z",
      guestName: "  Alice  ",
      guestEmail: "  alice@example.com  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "Alice",
        guestEmail: "alice@example.com",
      },
    });
  });

  it("отклоняет guestName из одних пробелов", () => {
    expect(
      normalizeBookingInput({
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "   ",
      }),
    ).toEqual({ ok: false });
  });

  it("преобразует пустой после trim guestEmail в отсутствие поля", () => {
    expect(
      normalizeBookingInput({
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "Alice",
        guestEmail: "   ",
      }),
    ).toEqual({
      ok: true,
      value: {
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "Alice",
      },
    });
  });

  it("сохраняет отсутствие guestEmail", () => {
    expect(
      normalizeBookingInput({
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "Alice",
      }),
    ).toEqual({
      ok: true,
      value: {
        eventTypeId: "evt_1",
        start: "2026-08-10T06:00:00Z",
        guestName: "Alice",
      },
    });
  });
});
