import type { t_PublicConfig } from "./generated/models.ts";

export const config: t_PublicConfig = {
  timezone: "Europe/Moscow",
  bookingWindowDays: 14,
  slotStepMinutes: 15,
  workingHours: {
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "18:00",
  },
};
