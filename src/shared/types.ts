// The API contract. Written once, imported by both src/api and src/web so the
// frontend cannot call an endpoint shape the backend never built (ADR-010).

export type LinkStatus = 'unread' | 'read';
export type LinkSource = 'share' | 'manual';

export interface Link {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  status: LinkStatus;
  source: LinkSource | null;
  created_at: number;
  read_at: number | null;
}

export interface CreateLinkBody {
  url: string;
  title?: string | null;
  source: LinkSource;
}

export interface UpdateLinkBody {
  status: LinkStatus;
}

export interface ApiError {
  error: { code: string; message: string };
}

/**
 * GET  /api/links?status=unread   -> Link[]        (newest first)
 * POST /api/links                 -> Link          (201)
 * PATCH /api/links/:id            -> Link
 * DELETE /api/links/:id           -> 204, no body
 */
