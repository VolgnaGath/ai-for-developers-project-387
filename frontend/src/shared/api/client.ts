import createClient from 'openapi-fetch';
import type { paths } from './generated';
import { apiBaseUrl } from './config';
import { classifyApiError, NetworkError } from './errors';

export const apiClient = createClient<paths>({ baseUrl: apiBaseUrl });

export interface OperationResult<T> {
  data?: T;
  error?: { code?: string } | null;
  response: Response;
}

export async function unwrap<T>(call: () => Promise<OperationResult<T>>): Promise<T> {
  let result: OperationResult<T>;
  try {
    result = await call();
  } catch (cause) {
    throw new NetworkError('Не удалось соединиться с сервером. Попробуйте ещё раз.', { cause });
  }

  if (result.response.ok) {
    return result.data as T;
  }

  throw classifyApiError(result.response.status, result.error);
}
