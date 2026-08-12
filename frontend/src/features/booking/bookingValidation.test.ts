import { describe, expect, it } from 'vitest';
import { validateBookingForm } from './bookingValidation';

describe('validateBookingForm', () => {
  it('requires a non-empty trimmed name', () => {
    expect(validateBookingForm({ guestName: '', guestEmail: '' })).toEqual({
      guestName: 'Укажите ваше имя',
    });
    expect(validateBookingForm({ guestName: '   ', guestEmail: '' })).toEqual({
      guestName: 'Укажите ваше имя',
    });
  });

  it('accepts a name with surrounding whitespace', () => {
    expect(validateBookingForm({ guestName: '  Иван  ', guestEmail: '' })).toEqual({});
  });

  it('rejects an invalid email and keeps the name error', () => {
    expect(validateBookingForm({ guestName: 'Иван', guestEmail: 'not-an-email' })).toEqual({
      guestEmail: 'Введите корректный email',
    });
  });

  it('accepts a valid email', () => {
    expect(
      validateBookingForm({ guestName: 'Иван', guestEmail: 'ivan@example.com' }),
    ).toEqual({});
  });

  it('treats a whitespace-only email as empty', () => {
    expect(validateBookingForm({ guestName: 'Иван', guestEmail: '  ' })).toEqual({});
  });
});
