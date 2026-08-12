import { ExpressRuntimeError, RequestInputType } from "@nahkies/typescript-express-runtime/errors";
import { Temporal } from "@js-temporal/polyfill";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, errorHandler } from "../src/app.ts";
import type { Clock } from "../src/clock.ts";
import type { IdGenerator } from "../src/ids.ts";
import { createStore } from "../src/store.ts";

const NOW = Temporal.Instant.from("2026-08-10T06:00:00Z");

class MutableClock implements Clock {
  private value: Temporal.Instant;

  constructor(value: Temporal.Instant) {
    this.value = value;
  }

  now(): Temporal.Instant {
    return this.value;
  }

  set(value: Temporal.Instant): void {
    this.value = value;
  }
}

function makeIds(): IdGenerator {
  let evt = 0;
  let booking = 0;
  return {
    eventTypeId: () => `evt_test_${evt++}`,
    bookingId: () => `bk_test_${booking++}`,
  };
}

function makeApp() {
  const clock = new MutableClock(NOW);
  const store = createStore({ clock, ids: makeIds() });
  const app = createApp({ store, clock });
  return { app, store, clock };
}

const consultation = {
  eventTypeId: "evt_consultation",
  start: "2026-08-10T06:00:00Z",
  guestName: "Alice",
  guestEmail: "alice@example.com",
};

describe("health и config", () => {
  it("GET /health возвращает 200 ok", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /config возвращает фиксированную доступность", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/config").expect(200);
    expect(res.body).toEqual({
      timezone: "Europe/Moscow",
      bookingWindowDays: 14,
      slotStepMinutes: 15,
      workingHours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
    });
  });
});

describe("типы событий", () => {
  it("список начинается с seed-типов в порядке создания", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/admin/event-types").expect(200);
    expect(res.body.map((type: { id: string }) => type.id)).toEqual([
      "evt_consultation",
      "evt_onboarding",
    ]);
  });

  it("публичный список типов совпадает с административным", async () => {
    const { app } = makeApp();
    const admin = await request(app).get("/admin/event-types").expect(200);
    const public_ = await request(app).get("/event-types").expect(200);
    expect(public_.body).toEqual(admin.body);
  });

  it("создание обрезает строки и опускает пустой description", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/admin/event-types")
      .send({ title: "  Встреча  ", description: "   ", durationMinutes: 15 })
      .expect(200);
    expect(res.body).toEqual({
      id: "evt_test_0",
      title: "Встреча",
      durationMinutes: 15,
    });
  });

  it("создание с пустым после trim title возвращает 400", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/admin/event-types")
      .send({ title: "   ", durationMinutes: 15 })
      .expect(400);
    expect(res.body).toEqual({ code: "bad_request" });
  });

  it("создание с отсутствующими полями возвращает 400", async () => {
    const { app } = makeApp();
    await request(app).post("/admin/event-types").send({}).expect(400);
  });

  it("GET и просмотр типа возвращают тип", async () => {
    const { app } = makeApp();
    const admin = await request(app).get("/admin/event-types/evt_consultation").expect(200);
    const public_ = await request(app).get("/event-types/evt_consultation").expect(200);
    expect(admin.body).toEqual({
      id: "evt_consultation",
      title: "Консультация",
      description: "Короткий созвон, чтобы обсудить ваш вопрос.",
      durationMinutes: 30,
    });
    expect(public_.body).toEqual(admin.body);
  });

  it("неизвестный тип возвращает 404", async () => {
    const { app } = makeApp();
    await request(app).get("/admin/event-types/evt_missing").expect(404, {
      code: "not_found",
    });
    await request(app).get("/event-types/evt_missing").expect(404, {
      code: "not_found",
    });
  });

  it("редактирование меняет поля и сохраняет порядок", async () => {
    const { app } = makeApp();
    await request(app)
      .put("/admin/event-types/evt_consultation")
      .send({ title: "  Консультация v2  ", durationMinutes: 30 })
      .expect(200);
    const res = await request(app).get("/admin/event-types").expect(200);
    expect(res.body.map((type: { id: string }) => type.id)).toEqual([
      "evt_consultation",
      "evt_onboarding",
    ]);
    expect(res.body[0]).toMatchObject({ title: "Консультация v2" });
  });

  it("редактирование неизвестного типа возвращает 404", async () => {
    const { app } = makeApp();
    await request(app)
      .put("/admin/event-types/evt_missing")
      .send({ title: "Тип", durationMinutes: 15 })
      .expect(404, { code: "not_found" });
  });

  it("удаление без броней возвращает 204", async () => {
    const { app } = makeApp();
    await request(app)
      .delete("/admin/event-types/evt_onboarding")
      .expect(204);
    await request(app).get("/admin/event-types/evt_onboarding").expect(404);
  });

  it("удаление неизвестного типа возвращает 404", async () => {
    const { app } = makeApp();
    await request(app)
      .delete("/admin/event-types/evt_missing")
      .expect(404, { code: "not_found" });
  });
});

describe("слоты", () => {
  it("нарезает 30-минутные слоты понедельника от начала рабочих часов", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get("/event-types/evt_consultation/slots")
      .query({ from: "2026-08-10", to: "2026-08-10" })
      .expect(200);
    expect(res.body).toHaveLength(35);
    expect(res.body[0]).toEqual({
      start: "2026-08-10T06:00:00Z",
      end: "2026-08-10T06:30:00Z",
    });
    expect(res.body.at(-1)).toEqual({
      start: "2026-08-10T14:30:00Z",
      end: "2026-08-10T15:00:00Z",
    });
    for (const slot of res.body) {
      expect(slot.start.endsWith("Z")).toBe(true);
      expect(slot.end.endsWith("Z")).toBe(true);
    }
  });

  it("неизвестный тип возвращает 404", async () => {
    const { app } = makeApp();
    await request(app)
      .get("/event-types/evt_missing/slots")
      .query({ from: "2026-08-10", to: "2026-08-10" })
      .expect(404, { code: "not_found" });
  });

  it("диапазон from > to возвращает 400", async () => {
    const { app } = makeApp();
    await request(app)
      .get("/event-types/evt_consultation/slots")
      .query({ from: "2026-08-12", to: "2026-08-10" })
      .expect(400, { code: "bad_request" });
  });

  it("некорректные query-параметры возвращают 400", async () => {
    const { app } = makeApp();
    await request(app)
      .get("/event-types/evt_consultation/slots")
      .query({ from: "2026-08-10" })
      .expect(400);
    await request(app)
      .get("/event-types/evt_consultation/slots")
      .query({ from: "not-a-date", to: "2026-08-10" })
      .expect(400);
  });

  it("диапазон целиком вне окна возвращает пустой список", async () => {
    const { app } = makeApp();
    await request(app)
      .get("/event-types/evt_consultation/slots")
      .query({ from: "2026-08-24", to: "2026-08-30" })
      .expect(200, []);
  });
});

describe("брони", () => {
  it("создание брони возвращает бронь с серверными полями", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/bookings")
      .send({ ...consultation, guestName: "  Alice  " })
      .expect(200);
    expect(res.body).toEqual({
      id: "bk_test_0",
      eventTypeId: "evt_consultation",
      guestName: "Alice",
      guestEmail: "alice@example.com",
      start: "2026-08-10T06:00:00Z",
      end: "2026-08-10T06:30:00Z",
      status: "confirmed",
      createdAt: "2026-08-10T06:00:00Z",
    });
  });

  it("пустой после trim guestEmail не возвращается", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/bookings")
      .send({ ...consultation, guestEmail: "   " })
      .expect(200);
    expect(res.body.guestEmail).toBeUndefined();
  });

  it("пустой после trim guestName возвращает 400", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, guestName: "   " })
      .expect(400, { code: "bad_request" });
  });

  it("неизвестный тип события возвращает 404", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, eventTypeId: "evt_missing" })
      .expect(404, { code: "not_found" });
  });

  it("старт с секундами возвращает 422", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, start: "2026-08-10T06:00:30Z" })
      .expect(422, { code: "invalid_slot" });
  });

  it("старт вне сетки возвращает 422", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, start: "2026-08-10T06:07:00Z" })
      .expect(422, { code: "invalid_slot" });
  });

  it("старт вне рабочих часов возвращает 422", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, start: "2026-08-10T05:00:00Z" })
      .expect(422, { code: "invalid_slot" });
  });

  it("старт вне окна бронирования возвращает 422", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, start: "2026-08-24T06:00:00Z" })
      .expect(422, { code: "invalid_slot" });
  });

  it("повторное бронирование того же слота возвращает 409", async () => {
    const { app } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    await request(app)
      .post("/bookings")
      .send(consultation)
      .expect(409, { code: "slot_unavailable" });
  });

  it("занятость владельца общая между типами событий", async () => {
    const { app } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    await request(app)
      .post("/bookings")
      .send({
        eventTypeId: "evt_onboarding",
        start: "2026-08-10T06:15:00Z",
        guestName: "Bob",
      })
      .expect(409, { code: "slot_unavailable" });
  });

  it("список броней возвращается хронологически и фильтруется включительно", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/bookings")
      .send({ ...consultation, start: "2026-08-10T07:00:00Z" })
      .expect(200);
    await request(app).post("/bookings").send(consultation).expect(200);

    const all = await request(app).get("/admin/bookings").expect(200);
    expect(all.body.map((booking: { start: string }) => booking.start)).toEqual([
      "2026-08-10T06:00:00Z",
      "2026-08-10T07:00:00Z",
    ]);

    const range = await request(app)
      .get("/admin/bookings")
      .query({ from: "2026-08-10", to: "2026-08-10" })
      .expect(200);
    expect(range.body).toHaveLength(2);

    const after = await request(app)
      .get("/admin/bookings")
      .query({ from: "2026-08-11" })
      .expect(200);
    expect(after.body).toEqual([]);

    const before = await request(app)
      .get("/admin/bookings")
      .query({ to: "2026-08-09" })
      .expect(200);
    expect(before.body).toEqual([]);
  });
});

describe("брони блокируют изменение длительности и удаление", () => {
  it("будущая бронь блокирует смену длительности", async () => {
    const { app } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    await request(app)
      .put("/admin/event-types/evt_consultation")
      .send({ title: "Консультация", durationMinutes: 15 })
      .expect(409, { code: "event_type_duration_locked" });
  });

  it("прошедшая бронь тоже блокирует смену длительности", async () => {
    const { app, clock } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    clock.set(Temporal.Instant.from("2026-08-12T06:00:00Z"));
    await request(app)
      .put("/admin/event-types/evt_consultation")
      .send({ title: "Консультация", durationMinutes: 15 })
      .expect(409, { code: "event_type_duration_locked" });
  });

  it("та же длительность с бронями редактируется", async () => {
    const { app } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    const res = await request(app)
      .put("/admin/event-types/evt_consultation")
      .send({ title: "  Консультация v2  ", durationMinutes: 30 })
      .expect(200);
    expect(res.body.title).toBe("Консультация v2");
  });

  it("бронь блокирует удаление типа", async () => {
    const { app } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    await request(app)
      .delete("/admin/event-types/evt_consultation")
      .expect(409, { code: "event_type_has_bookings" });
  });

  it("прошедшая бронь тоже блокирует удаление", async () => {
    const { app, clock } = makeApp();
    await request(app).post("/bookings").send(consultation).expect(200);
    clock.set(Temporal.Instant.from("2026-08-12T06:00:00Z"));
    await request(app)
      .delete("/admin/event-types/evt_consultation")
      .expect(409, { code: "event_type_has_bookings" });
  });
});

describe("нештатные запросы", () => {
  it("malformed JSON возвращает 400", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/admin/event-types")
      .set("Content-Type", "application/json")
      .send('{"title": ')
      .expect(400, { code: "bad_request" });
  });

  it("тело больше 100kb возвращает 413", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/admin/event-types")
      .send({ title: "x".repeat(200_000), durationMinutes: 15 })
      .expect(413, { code: "payload_too_large" });
  });

  it("неизвестный маршрут возвращает 404", async () => {
    const { app } = makeApp();
    await request(app).get("/nope").expect(404, { code: "not_found" });
  });

  it("неизвестный метод возвращает 404", async () => {
    const { app } = makeApp();
    await request(app).patch("/admin/event-types").expect(404, {
      code: "not_found",
    });
  });
});

describe("CORS", () => {
  it("добавляет Access-Control-Allow-Origin для разрешённого origin", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("не добавляет CORS-заголовки для чужого origin, но отвечает", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.status).toBe(200);
  });

  it("preflight для разрешённого origin отвечает CORS-заголовками", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .options("/bookings")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("запрос без Origin работает", async () => {
    const { app } = makeApp();
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("использует кастомный frontendOrigin из createApp", async () => {
    const clock = new MutableClock(NOW);
    const store = createStore({ clock, ids: makeIds() });
    const app = createApp({ store, clock, frontendOrigin: "http://custom.example" });
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://custom.example");
    expect(res.headers["access-control-allow-origin"]).toBe("http://custom.example");
  });
});

describe("errorHandler", () => {
  function stubRes() {
    let statusCode = 0;
    let body: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(value: unknown) {
        body = value;
        return res;
      },
      snapshot() {
        return { statusCode, body };
      },
    };
    return res;
  }

  const req = {} as Request;
  const next = (() => {}) as NextFunction;

  function handle(err: unknown) {
    const res = stubRes();
    errorHandler(err, req, res as unknown as Response, next);
    return res.snapshot();
  }

  it("request validation превращается в 400 bad_request", () => {
    expect(
      handle(
        ExpressRuntimeError.RequestError(
          new Error("invalid body"),
          RequestInputType.RequestBody,
        ),
      ),
    ).toEqual({ statusCode: 400, body: { code: "bad_request" } });
  });

  it("response validation превращается в 500 internal_error", () => {
    expect(handle(ExpressRuntimeError.ResponseError(new Error("bad body")))).toEqual({
      statusCode: 500,
      body: { code: "internal_error" },
    });
  });

  it("ошибка handler превращается в 500 internal_error", () => {
    expect(handle(ExpressRuntimeError.HandlerError(new Error("boom")))).toEqual({
      statusCode: 500,
      body: { code: "internal_error" },
    });
  });

  it("entity.too.large превращается в 413 payload_too_large", () => {
    expect(
      handle(Object.assign(new Error("too large"), { type: "entity.too.large" })),
    ).toEqual({ statusCode: 413, body: { code: "payload_too_large" } });
  });

  it("entity.parse.failed превращается в 400 bad_request", () => {
    expect(
      handle(Object.assign(new Error("bad json"), { type: "entity.parse.failed" })),
    ).toEqual({ statusCode: 400, body: { code: "bad_request" } });
  });

  it("неожиданная ошибка превращается в 500 internal_error", () => {
    expect(handle(new Error("unexpected"))).toEqual({
      statusCode: 500,
      body: { code: "internal_error" },
    });
  });
});
