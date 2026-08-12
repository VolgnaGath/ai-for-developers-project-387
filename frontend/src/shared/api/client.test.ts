import { describe, expect, it } from 'vitest';
import { unwrap } from './client';
import type { OperationResult } from './client';
import { isApiError, NetworkError } from './errors';

function okResult<T>(data: T): OperationResult<T> {
  return { data, error: null, response: { ok: true } as Response };
}

function errorResult<T>(status: number, code?: string): OperationResult<T> {
  return {
    data: undefined,
    error: code ? { code } : null,
    response: { ok: false, status } as Response,
  };
}

describe('unwrap', () => {
  it('returns data for a successful response', async () => {
    const booking = { id: 'b1', guestName: 'Иван' };
    await expect(unwrap(() => Promise.resolve(okResult(booking)))).resolves.toEqual(booking);
  });

  it('throws a typed not_found error on 404', async () => {
    const promise = unwrap(() => Promise.resolve(errorResult(404, 'not_found')));
    await expect(promise).rejects.toSatisfy((error: unknown) => isApiError(error));
    await expect(promise).rejects.toMatchObject({ code: 'not_found', status: 404 });
  });

  it('throws a typed slot_unavailable error on 409', async () => {
    const promise = unwrap(() => Promise.resolve(errorResult(409, 'slot_unavailable')));
    await expect(promise).rejects.toMatchObject({ code: 'slot_unavailable', status: 409 });
  });

  it('throws a typed invalid_slot error on 422', async () => {
    const promise = unwrap(() => Promise.resolve(errorResult(422, 'invalid_slot')));
    await expect(promise).rejects.toMatchObject({ code: 'invalid_slot', status: 422 });
  });

  it('throws an unexpected error for an unknown body', async () => {
    const promise = unwrap(() => Promise.resolve(errorResult(500)));
    await expect(promise).rejects.toMatchObject({ code: 'unexpected', status: 500 });
  });

  it('throws a NetworkError when the request itself fails', async () => {
    const promise = unwrap(() => Promise.reject(new TypeError('fetch failed')));
    await expect(promise).rejects.toBeInstanceOf(NetworkError);
  });
});
