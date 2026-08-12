import { apiClient, unwrap } from './client';
import type { components } from './generated';

export type EventType = components['schemas']['EventType'];
export type EventTypeInput = components['schemas']['EventTypeInput'];

export function listEventTypes(): Promise<EventType[]> {
  return unwrap(() => apiClient.GET('/admin/event-types'));
}

export function createEventType(input: EventTypeInput): Promise<EventType> {
  return unwrap(() => apiClient.POST('/admin/event-types', { body: input }));
}

export function getEventType(id: string): Promise<EventType> {
  return unwrap(() => apiClient.GET('/admin/event-types/{id}', { params: { path: { id } } }));
}

export function updateEventType(id: string, input: EventTypeInput): Promise<EventType> {
  return unwrap(() =>
    apiClient.PUT('/admin/event-types/{id}', { params: { path: { id } }, body: input }),
  );
}

export function deleteEventType(id: string): Promise<void> {
  return unwrap(() => apiClient.DELETE('/admin/event-types/{id}', { params: { path: { id } } }));
}

export function browseEventTypes(): Promise<EventType[]> {
  return unwrap(() => apiClient.GET('/event-types'));
}

export function viewEventType(id: string): Promise<EventType> {
  return unwrap(() => apiClient.GET('/event-types/{id}', { params: { path: { id } } }));
}
