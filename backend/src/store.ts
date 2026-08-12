import { Temporal } from "@js-temporal/polyfill";
import type { Clock } from "./clock.ts";
import type { IdGenerator } from "./ids.ts";
import type {
  t_Booking,
  t_BookingInput,
  t_EventType,
  t_EventTypeInput,
} from "./generated/models.ts";

export interface StoreDeps {
  clock: Clock;
  ids: IdGenerator;
}

export type CreateBookingResult =
  | { ok: true; booking: t_Booking }
  | { ok: false; reason: "not_found" | "conflict" };

export interface Store {
  listEventTypes(): t_EventType[];
  getEventType(id: string): t_EventType | undefined;
  createEventType(input: t_EventTypeInput): t_EventType;
  updateEventType(id: string, input: t_EventTypeInput): t_EventType | undefined;
  deleteEventType(id: string): boolean;
  hasBookingsForEventType(id: string): boolean;
  allBookings(): t_Booking[];
  hasConflict(start: Temporal.Instant, end: Temporal.Instant): boolean;
  createBooking(input: t_BookingInput): CreateBookingResult;
}

const SEED_EVENT_TYPES: readonly t_EventType[] = [
  {
    id: "evt_consultation",
    title: "Консультация",
    description: "Короткий созвон, чтобы обсудить ваш вопрос.",
    durationMinutes: 30,
  },
  {
    id: "evt_onboarding",
    title: "Онбординг",
    durationMinutes: 15,
  },
];

function overlaps(
  start: Temporal.Instant,
  end: Temporal.Instant,
  otherStart: Temporal.Instant,
  otherEnd: Temporal.Instant,
): boolean {
  return (
    Temporal.Instant.compare(start, otherEnd) < 0 &&
    Temporal.Instant.compare(otherStart, end) < 0
  );
}

export function createStore(deps: StoreDeps): Store {
  const eventTypes = new Map<string, t_EventType>();
  for (const eventType of SEED_EVENT_TYPES) {
    eventTypes.set(eventType.id, eventType);
  }

  const bookings = new Map<string, t_Booking>();

  function hasConflict(start: Temporal.Instant, end: Temporal.Instant): boolean {
    for (const booking of bookings.values()) {
      const bookingStart = Temporal.Instant.from(booking.start);
      const bookingEnd = Temporal.Instant.from(booking.end);
      if (overlaps(start, end, bookingStart, bookingEnd)) return true;
    }
    return false;
  }

  return {
    listEventTypes() {
      return [...eventTypes.values()];
    },

    getEventType(id) {
      return eventTypes.get(id);
    },

    createEventType(input) {
      const eventType: t_EventType = {
        id: deps.ids.eventTypeId(),
        ...input,
      };
      eventTypes.set(eventType.id, eventType);
      return eventType;
    },

    updateEventType(id, input) {
      const existing = eventTypes.get(id);
      if (!existing) return undefined;
      const updated: t_EventType = {
        ...existing,
        ...input,
      };
      eventTypes.set(id, updated);
      return updated;
    },

    deleteEventType(id) {
      return eventTypes.delete(id);
    },

    hasBookingsForEventType(id) {
      for (const booking of bookings.values()) {
        if (booking.eventTypeId === id) return true;
      }
      return false;
    },

    allBookings() {
      return [...bookings.values()];
    },

    hasConflict,

    createBooking(input) {
      const eventType = eventTypes.get(input.eventTypeId);
      if (!eventType) return { ok: false, reason: "not_found" };

      const start = Temporal.Instant.from(input.start);
      const end = start.add({ minutes: eventType.durationMinutes });
      if (hasConflict(start, end)) return { ok: false, reason: "conflict" };

      const booking: t_Booking = {
        id: deps.ids.bookingId(),
        eventTypeId: input.eventTypeId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        start: start.toString(),
        end: end.toString(),
        status: "confirmed",
        createdAt: deps.clock.now().toString(),
      };
      bookings.set(booking.id, booking);
      return { ok: true, booking };
    },
  };
}
