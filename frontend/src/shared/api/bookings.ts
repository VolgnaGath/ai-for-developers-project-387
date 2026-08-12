import { apiClient, unwrap } from './client';
import type { components } from './generated';

export type Booking = components['schemas']['Booking'];
export type BookingInput = components['schemas']['BookingInput'];
export type Slot = components['schemas']['Slot'];
export type PublicConfig = components['schemas']['PublicConfig'];

export function getConfig(): Promise<PublicConfig> {
  return unwrap(() => apiClient.GET('/config'));
}

export function listSlots(eventTypeId: string, from: string, to: string): Promise<Slot[]> {
  return unwrap(() =>
    apiClient.GET('/event-types/{id}/slots', {
      params: { path: { id: eventTypeId }, query: { from, to } },
    }),
  );
}

export interface ListBookingsParams {
  from?: string;
  to?: string;
}

export function listBookings(params: ListBookingsParams = {}): Promise<Booking[]> {
  return unwrap(() => apiClient.GET('/admin/bookings', { params: { query: params } }));
}

export function createBooking(input: BookingInput): Promise<Booking> {
  return unwrap(() => apiClient.POST('/bookings', { body: input }));
}
