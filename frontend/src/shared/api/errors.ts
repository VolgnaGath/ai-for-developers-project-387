export type ApiError =
  | { code: 'bad_request'; status: 400; message: string }
  | { code: 'not_found'; status: 404; message: string }
  | { code: 'payload_too_large'; status: 413; message: string }
  | { code: 'invalid_slot'; status: 422; message: string }
  | { code: 'slot_unavailable'; status: 409; message: string }
  | { code: 'event_type_has_bookings'; status: 409; message: string }
  | { code: 'event_type_duration_locked'; status: 409; message: string }
  | { code: 'internal_error'; status: 500; message: string }
  | { code: 'unexpected'; status: number; message: string };

const API_ERROR_CODES = [
  'bad_request',
  'not_found',
  'payload_too_large',
  'invalid_slot',
  'slot_unavailable',
  'event_type_has_bookings',
  'event_type_duration_locked',
  'internal_error',
] as const;

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const code = (value as { code?: unknown }).code;
  return API_ERROR_CODES.includes(code as (typeof API_ERROR_CODES)[number]);
}

export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export function classifyApiError(
  status: number,
  body: { code?: string } | null | undefined,
): ApiError {
  switch (body?.code) {
    case 'bad_request':
      return {
        code: 'bad_request',
        status: 400,
        message: 'Неверный запрос. Проверьте введённые данные и попробуйте ещё раз.',
      };
    case 'not_found':
      return { code: 'not_found', status: 404, message: 'Запрашиваемый ресурс не найден.' };
    case 'payload_too_large':
      return {
        code: 'payload_too_large',
        status: 413,
        message: 'Слишком большое тело запроса.',
      };
    case 'slot_unavailable':
      return {
        code: 'slot_unavailable',
        status: 409,
        message: 'Этот слот уже занят. Выберите другой слот.',
      };
    case 'invalid_slot':
      return {
        code: 'invalid_slot',
        status: 422,
        message: 'Выбранный слот недоступен. Выберите другой слот.',
      };
    case 'event_type_has_bookings':
      return {
        code: 'event_type_has_bookings',
        status: 409,
        message: 'Нельзя удалить тип события: у него есть существующие брони.',
      };
    case 'event_type_duration_locked':
      return {
        code: 'event_type_duration_locked',
        status: 409,
        message: 'Нельзя изменить длительность типа события: у него есть существующие брони.',
      };
    case 'internal_error':
      return {
        code: 'internal_error',
        status: 500,
        message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      };
    default:
      return {
        code: 'unexpected',
        status,
        message: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      };
  }
}
