import type { t_BookingInput, t_EventTypeInput } from "./generated/models.ts";

export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false };

export function normalizeEventTypeInput(
  input: t_EventTypeInput,
): NormalizeResult<t_EventTypeInput> {
  const title = input.title.trim();
  if (title.length === 0) return { ok: false };

  const value: t_EventTypeInput = {
    title,
    durationMinutes: input.durationMinutes,
  };
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (description !== "") value.description = description;
  }
  return { ok: true, value };
}

export function normalizeBookingInput(
  input: t_BookingInput,
): NormalizeResult<t_BookingInput> {
  const guestName = input.guestName.trim();
  if (guestName.length === 0) return { ok: false };

  const value: t_BookingInput = {
    eventTypeId: input.eventTypeId,
    start: input.start,
    guestName,
  };
  if (input.guestEmail !== undefined) {
    const guestEmail = input.guestEmail.trim();
    if (guestEmail !== "") value.guestEmail = guestEmail;
  }
  return { ok: true, value };
}
