import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import type { Booking, BookingInput, PublicConfig } from '../../shared/api/bookings';
import type { EventType, EventTypeInput } from '../../shared/api/eventTypes';
import { instantDateKey, nowInZone, todayInZone } from '../../shared/date/timezone';
import { isBaseCandidateStart, listSlots } from './calendar';

const CONFIG_TIMEZONE = 'Europe/Moscow';

export interface MockDb {
  config: PublicConfig;
  eventTypes: EventType[];
  bookings: Booking[];
  nextBookingId: number;
  nextEventTypeId: number;
  conflictOnNextBooking: boolean;
  invalidSlotOnNextBooking: boolean;
}

function createMockDb(): MockDb {
  const config: PublicConfig = {
    timezone: CONFIG_TIMEZONE,
    bookingWindowDays: 14,
    slotStepMinutes: 15,
    workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
  };

  const eventTypes: EventType[] = [
    {
      id: 'event-type-consultation',
      title: 'Консультация',
      description: 'Разбор проекта и ответы на вопросы',
      durationMinutes: 30,
    },
    {
      id: 'event-type-onboarding',
      title: 'Онбординг',
      durationMinutes: 15,
    },
  ];

  const start = todayInZone(CONFIG_TIMEZONE).add(1, 'day').hour(14).minute(0).second(0).millisecond(0);
  const end = start.add(30, 'minute');

  const booking: Booking = {
    id: 'booking-1',
    eventTypeId: 'event-type-consultation',
    guestName: 'Иван Петров',
    guestEmail: 'ivan.petrov@example.com',
    start: start.toISOString(),
    end: end.toISOString(),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  return {
    config,
    eventTypes,
    bookings: [booking],
    nextBookingId: 2,
    nextEventTypeId: 2,
    conflictOnNextBooking: false,
    invalidSlotOnNextBooking: false,
  };
}

let mockDb: MockDb = createMockDb();

export function getMockDb(): MockDb {
  return mockDb;
}

export function resetMockDb(): MockDb {
  mockDb = createMockDb();
  return mockDb;
}

function busyIntervals(db: MockDb): { start: string; end: string }[] {
  return db.bookings.map((booking) => ({ start: booking.start, end: booking.end }));
}

function overlaps(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return dayjs(start).valueOf() < dayjs(otherEnd).valueOf() && dayjs(otherStart).valueOf() < dayjs(end).valueOf();
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function badRequest() {
  return HttpResponse.json({ code: 'bad_request' }, { status: 400 });
}

export const handlers = [
  http.get('/health', () => HttpResponse.json({ status: 'ok' })),

  http.get('/config', () => HttpResponse.json(getMockDb().config)),

  http.get('/event-types', () => HttpResponse.json(getMockDb().eventTypes)),

  http.get('/event-types/:eventTypeId', ({ params }) => {
    const eventType = getMockDb().eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(eventType);
  }),

  http.get('/event-types/:eventTypeId/slots', ({ request, params }) => {
    const db = getMockDb();
    const eventType = db.eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) return badRequest();

    const result = listSlots({
      config: db.config,
      durationMinutes: eventType.durationMinutes,
      now: nowInZone(db.config.timezone),
      from,
      to,
      busy: busyIntervals(db),
    });
    if (!result.ok) return badRequest();
    return HttpResponse.json(result.slots);
  }),

  http.post('/bookings', async ({ request }) => {
    const db = getMockDb();
    const input = await readJson<BookingInput>(request);
    if (!input) return badRequest();

    const eventType = db.eventTypes.find((et) => et.id === input.eventTypeId);
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }

    if (db.conflictOnNextBooking) {
      db.conflictOnNextBooking = false;
      const conflictEnd = dayjs(input.start).add(eventType.durationMinutes, 'minute').toISOString();
      db.bookings.push({
        id: `booking-${db.nextBookingId++}`,
        eventTypeId: input.eventTypeId,
        guestName: input.guestName.trim(),
        guestEmail: input.guestEmail?.trim() || undefined,
        start: dayjs(input.start).toISOString(),
        end: conflictEnd,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      });
      return HttpResponse.json({ code: 'slot_unavailable' }, { status: 409 });
    }

    if (db.invalidSlotOnNextBooking) {
      db.invalidSlotOnNextBooking = false;
      return HttpResponse.json({ code: 'invalid_slot' }, { status: 422 });
    }

    const guestName = input.guestName.trim();
    if (!guestName) return badRequest();

    const now = nowInZone(db.config.timezone);
    if (
      !isBaseCandidateStart({
        config: db.config,
        durationMinutes: eventType.durationMinutes,
        now,
        start: input.start,
      })
    ) {
      return HttpResponse.json({ code: 'invalid_slot' }, { status: 422 });
    }

    const start = dayjs(input.start).toISOString();
    const end = dayjs(input.start).add(eventType.durationMinutes, 'minute').toISOString();
    if (busyIntervals(db).some((interval) => overlaps(start, end, interval.start, interval.end))) {
      return HttpResponse.json({ code: 'slot_unavailable' }, { status: 409 });
    }

    const booking: Booking = {
      id: `booking-${db.nextBookingId++}`,
      eventTypeId: input.eventTypeId,
      guestName,
      guestEmail: input.guestEmail?.trim() || undefined,
      start,
      end,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return HttpResponse.json(booking);
  }),

  http.get('/admin/event-types', () => HttpResponse.json(getMockDb().eventTypes)),

  http.post('/admin/event-types', async ({ request }) => {
    const db = getMockDb();
    const input = await readJson<EventTypeInput>(request);
    if (!input) return badRequest();
    const title = input.title.trim();
    if (!title) return badRequest();

    const eventType: EventType = {
      id: `event-type-${db.nextEventTypeId++}`,
      title,
      description: input.description?.trim() || undefined,
      durationMinutes: input.durationMinutes,
    };
    db.eventTypes.push(eventType);
    return HttpResponse.json(eventType);
  }),

  http.get('/admin/event-types/:eventTypeId', ({ params }) => {
    const eventType = getMockDb().eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(eventType);
  }),

  http.put('/admin/event-types/:eventTypeId', async ({ params, request }) => {
    const db = getMockDb();
    const index = db.eventTypes.findIndex((et) => et.id === String(params.eventTypeId));
    if (index === -1) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const input = await readJson<EventTypeInput>(request);
    if (!input) return badRequest();
    const title = input.title.trim();
    if (!title) return badRequest();

    const existing = db.eventTypes[index];
    if (
      input.durationMinutes !== existing.durationMinutes &&
      db.bookings.some((booking) => booking.eventTypeId === existing.id)
    ) {
      return HttpResponse.json({ code: 'event_type_duration_locked' }, { status: 409 });
    }

    const eventType: EventType = {
      id: existing.id,
      title,
      description: input.description?.trim() || undefined,
      durationMinutes: input.durationMinutes,
    };
    db.eventTypes[index] = eventType;
    return HttpResponse.json(eventType);
  }),

  http.delete('/admin/event-types/:eventTypeId', ({ params }) => {
    const db = getMockDb();
    const eventType = db.eventTypes.find((et) => et.id === String(params.eventTypeId));
    if (!eventType) {
      return HttpResponse.json({ code: 'not_found' }, { status: 404 });
    }
    const hasBookings = db.bookings.some((booking) => booking.eventTypeId === eventType.id);
    if (hasBookings) {
      return HttpResponse.json({ code: 'event_type_has_bookings' }, { status: 409 });
    }
    db.eventTypes = db.eventTypes.filter((et) => et.id !== eventType.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/admin/bookings', ({ request }) => {
    const db = getMockDb();
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const timezone = db.config.timezone;
    const bookings = db.bookings
      .filter((booking) => {
        const date = instantDateKey(booking.start, timezone);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
    return HttpResponse.json(bookings);
  }),
];
