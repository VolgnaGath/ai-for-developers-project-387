import type { BookingFormValues } from './BookingForm';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

export function validateBookingForm(values: BookingFormValues): BookingFormErrors {
  const errors: BookingFormErrors = {};
  if (!values.guestName.trim()) {
    errors.guestName = 'Укажите ваше имя';
  }
  const email = values.guestEmail.trim();
  if (email && !EMAIL_RE.test(email)) {
    errors.guestEmail = 'Введите корректный email';
  }
  return errors;
}
