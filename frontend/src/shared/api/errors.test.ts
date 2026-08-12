import { describe, expect, it } from 'vitest';
import { classifyApiError, isApiError, NetworkError } from './errors';

describe('classifyApiError', () => {
  it('maps not_found to a typed 404 error', () => {
    const error = classifyApiError(404, { code: 'not_found' });
    expect(error).toEqual({
      code: 'not_found',
      status: 404,
      message: 'Запрашиваемый ресурс не найден.',
    });
  });

  it('maps slot_unavailable to a typed 409 error', () => {
    const error = classifyApiError(409, { code: 'slot_unavailable' });
    expect(error).toEqual({
      code: 'slot_unavailable',
      status: 409,
      message: 'Этот слот уже занят. Выберите другой слот.',
    });
  });

  it('maps invalid_slot to a typed 422 error', () => {
    const error = classifyApiError(422, { code: 'invalid_slot' });
    expect(error).toEqual({
      code: 'invalid_slot',
      status: 422,
      message: 'Выбранный слот недоступен. Выберите другой слот.',
    });
  });

  it('maps event_type_has_bookings to a typed 409 error', () => {
    const error = classifyApiError(409, { code: 'event_type_has_bookings' });
    expect(error).toEqual({
      code: 'event_type_has_bookings',
      status: 409,
      message: 'Нельзя удалить тип события: у него есть существующие брони.',
    });
  });

  it('maps event_type_duration_locked to a typed 409 error', () => {
    const error = classifyApiError(409, { code: 'event_type_duration_locked' });
    expect(error).toEqual({
      code: 'event_type_duration_locked',
      status: 409,
      message: 'Нельзя изменить длительность типа события: у него есть существующие брони.',
    });
  });

  it('maps bad_request to a typed 400 error', () => {
    const error = classifyApiError(400, { code: 'bad_request' });
    expect(error).toEqual({
      code: 'bad_request',
      status: 400,
      message: 'Неверный запрос. Проверьте введённые данные и попробуйте ещё раз.',
    });
  });

  it('maps payload_too_large to a typed 413 error', () => {
    const error = classifyApiError(413, { code: 'payload_too_large' });
    expect(error).toEqual({
      code: 'payload_too_large',
      status: 413,
      message: 'Слишком большое тело запроса.',
    });
  });

  it('maps internal_error to a typed 500 error', () => {
    const error = classifyApiError(500, { code: 'internal_error' });
    expect(error).toEqual({
      code: 'internal_error',
      status: 500,
      message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    });
  });

  it('falls back to unexpected for unknown codes and empty bodies', () => {
    expect(classifyApiError(500, null)).toEqual({
      code: 'unexpected',
      status: 500,
      message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    });
    expect(classifyApiError(502, { code: 'something_else' })).toEqual({
      code: 'unexpected',
      status: 502,
      message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    });
  });
});

describe('isApiError', () => {
  it('recognizes known API error codes', () => {
    for (const code of [
      'not_found',
      'slot_unavailable',
      'invalid_slot',
      'event_type_has_bookings',
      'event_type_duration_locked',
      'bad_request',
      'payload_too_large',
      'internal_error',
    ]) {
      expect(isApiError({ code, status: 409, message: 'x' })).toBe(true);
    }
  });

  it('rejects unexpected codes and non-objects', () => {
    expect(isApiError({ code: 'unexpected', status: 500, message: 'x' })).toBe(false);
    expect(isApiError({ code: 'unknown' })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('not_found')).toBe(false);
    expect(isApiError(42)).toBe(false);
  });
});

describe('NetworkError', () => {
  it('is an Error with the NetworkError name', () => {
    const error = new NetworkError('сеть недоступна');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('сеть недоступна');
  });
});
