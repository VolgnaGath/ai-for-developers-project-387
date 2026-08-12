import { randomUUID } from "node:crypto";

export interface IdGenerator {
  eventTypeId(): string;
  bookingId(): string;
}

export function createIdGenerator(uuid: () => string = randomUUID): IdGenerator {
  return {
    eventTypeId: () => `evt_${uuid()}`,
    bookingId: () => `bk_${uuid()}`,
  };
}
