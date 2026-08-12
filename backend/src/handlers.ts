import { Temporal } from "@js-temporal/polyfill";
import {
  isBaseCandidateStart,
  isInstantInDateRange,
  listSlots as calendarListSlots,
} from "./calendar.ts";
import type { Clock } from "./clock.ts";
import { config } from "./config.ts";
import type { Implementation } from "./generated/generated.ts";
import { normalizeBookingInput, normalizeEventTypeInput } from "./normalize.ts";
import type { Store } from "./store.ts";

export function createHandlers(store: Store, clock: Clock): Implementation {
  return {
    async listBookings({ query }, respond) {
      const timezone = config.timezone;
      const bookings = store
        .allBookings()
        .filter((booking) =>
          isInstantInDateRange(
            Temporal.Instant.from(booking.start),
            timezone,
            query.from,
            query.to,
          ),
        )
        .sort((a, b) =>
          Temporal.Instant.compare(
            Temporal.Instant.from(a.start),
            Temporal.Instant.from(b.start),
          ),
        );
      return respond.with200().body(bookings);
    },

    async listEventTypes(_params, respond) {
      return respond.with200().body(store.listEventTypes());
    },

    async createEventType({ body }, respond) {
      const normalized = normalizeEventTypeInput(body);
      if (!normalized.ok) return respond.with400().body({ code: "bad_request" });
      return respond.with200().body(store.createEventType(normalized.value));
    },

    async getEventType({ params }, respond) {
      const eventType = store.getEventType(params.id);
      return eventType
        ? respond.with200().body(eventType)
        : respond.with404().body({ code: "not_found" });
    },

    async updateEventType({ params, body }, respond) {
      const normalized = normalizeEventTypeInput(body);
      if (!normalized.ok) return respond.with400().body({ code: "bad_request" });

      const existing = store.getEventType(params.id);
      if (!existing) return respond.with404().body({ code: "not_found" });

      if (
        normalized.value.durationMinutes !== existing.durationMinutes &&
        store.hasBookingsForEventType(params.id)
      ) {
        return respond.with409().body({ code: "event_type_duration_locked" });
      }

      const updated = store.updateEventType(params.id, normalized.value);
      return respond.with200().body(updated!);
    },

    async deleteEventType({ params }, respond) {
      if (!store.getEventType(params.id)) {
        return respond.with404().body({ code: "not_found" });
      }
      if (store.hasBookingsForEventType(params.id)) {
        return respond.with409().body({ code: "event_type_has_bookings" });
      }
      store.deleteEventType(params.id);
      return respond.with204();
    },

    async createBooking({ body }, respond) {
      const normalized = normalizeBookingInput(body);
      if (!normalized.ok) return respond.with400().body({ code: "bad_request" });

      const eventType = store.getEventType(normalized.value.eventTypeId);
      if (!eventType) return respond.with404().body({ code: "not_found" });

      const start = Temporal.Instant.from(normalized.value.start);
      if (
        !isBaseCandidateStart({
          config,
          durationMinutes: eventType.durationMinutes,
          now: clock.now(),
          start,
        })
      ) {
        return respond.with422().body({ code: "invalid_slot" });
      }

      const result = store.createBooking(normalized.value);
      if (!result.ok) {
        return result.reason === "conflict"
          ? respond.with409().body({ code: "slot_unavailable" })
          : respond.with404().body({ code: "not_found" });
      }
      return respond.with200().body(result.booking);
    },

    async getConfig(_params, respond) {
      return respond.with200().body(config);
    },

    async browseEventTypes(_params, respond) {
      return respond.with200().body(store.listEventTypes());
    },

    async viewEventType({ params }, respond) {
      const eventType = store.getEventType(params.id);
      return eventType
        ? respond.with200().body(eventType)
        : respond.with404().body({ code: "not_found" });
    },

    async listSlots({ params, query }, respond) {
      const eventType = store.getEventType(params.id);
      if (!eventType) return respond.with404().body({ code: "not_found" });

      const busy = store.allBookings().map((booking) => ({
        start: Temporal.Instant.from(booking.start),
        end: Temporal.Instant.from(booking.end),
      }));

      const result = calendarListSlots({
        config,
        durationMinutes: eventType.durationMinutes,
        now: clock.now(),
        from: query.from,
        to: query.to,
        busy,
      });
      if (!result.ok) return respond.with400().body({ code: "bad_request" });
      return respond.with200().body(result.slots);
    },

    async health(_params, respond) {
      return respond.with200().body({ status: "ok" });
    },
  };
}
