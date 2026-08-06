import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error envelope per the standards: `{ "error": { code, message } }`.
 * Status codes carry meaning; the envelope does not repeat them.
 */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function fail(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const unauthorized = (message: string) => new HttpError(401, 'unauthorized', message);
export const notFound = (message: string) => new HttpError(404, 'not_found', message);
