import { Temporal } from "@js-temporal/polyfill";

export interface Clock {
  now(): Temporal.Instant;
}

export const systemClock: Clock = {
  now: () => Temporal.Now.instant(),
};
