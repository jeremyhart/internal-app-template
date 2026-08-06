import type { ApiError, CreateLinkBody, Link, LinkStatus } from '../../shared/types';

/**
 * The only place the app calls `fetch` (enforced by the pre-commit hook,
 * ADR-009). Requests are same-origin so the Access cookie is attached without
 * any CORS or credentials dance.
 */

const BASE = '/api';

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * An expired Access session answers a same-origin XHR with a redirect to the
 * login page, not with JSON. Reloading turns that into a normal top-level
 * navigation, which is what Access needs in order to re-authenticate — so the
 * user sees a login screen rather than a broken one.
 */
function reauthenticate(): never {
  window.location.reload();
  throw new ApiFailure('reauthenticating', 'Signing you back in…');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiFailure('network', 'Could not reach the server.');
  }

  if (res.status === 401 || res.redirected) reauthenticate();

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // Access served an HTML login page in place of our API response.
    if (contentType.includes('text/html')) reauthenticate();
    if (res.ok) return undefined as T;
    throw new ApiFailure('unexpected_response', 'The server sent an unexpected response.');
  }

  const body = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const { error } = body as ApiError;
    throw new ApiFailure(error?.code ?? 'unknown', error?.message ?? 'Something went wrong.');
  }
  return body as T;
}

export interface AppStatus {
  app: string;
  user: string;
  summarisation_enabled: boolean;
  pending_summaries: number;
}

export const api = {
  listLinks: (status?: LinkStatus) =>
    request<Link[]>(`/links${status ? `?status=${status}` : ''}`),

  createLink: (body: CreateLinkBody) =>
    request<Link>('/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  setStatus: (id: string, status: LinkStatus) =>
    request<Link>(`/links/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),

  deleteLink: (id: string) =>
    request<void>(`/links/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  status: () => request<AppStatus>('/status'),
};
