import type { EventTypeFormValues } from './EventTypeForm';

export type EventTypeFormErrors = Partial<Record<keyof EventTypeFormValues, string>>;

export function validateEventTypeForm(values: EventTypeFormValues): EventTypeFormErrors {
  const errors: EventTypeFormErrors = {};
  if (!values.title.trim()) {
    errors.title = 'Укажите название';
  }
  if (values.durationMinutes !== 15 && values.durationMinutes !== 30) {
    errors.durationMinutes = 'Выберите длительность встречи';
  }
  return errors;
}
