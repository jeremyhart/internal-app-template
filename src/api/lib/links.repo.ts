import type { Link, LinkSource, LinkStatus } from '../../shared/types';
import type { Env } from './env';

/**
 * The only place `env.DB` is touched for the links table. Routes call this;
 * they do not write SQL (enforced by the pre-commit hook, ADR-009).
 */

export async function listLinks(env: Env, status?: LinkStatus): Promise<Link[]> {
  const query = status
    ? env.DB.prepare(
        'SELECT * FROM links WHERE status = ?1 ORDER BY created_at DESC LIMIT 500',
      ).bind(status)
    : env.DB.prepare('SELECT * FROM links ORDER BY created_at DESC LIMIT 500');

  const { results } = await query.all<Link>();
  return results ?? [];
}

export async function getLink(env: Env, id: string): Promise<Link | null> {
  return env.DB.prepare('SELECT * FROM links WHERE id = ?1').bind(id).first<Link>();
}

export async function createLink(
  env: Env,
  input: { url: string; title: string | null; source: LinkSource },
): Promise<Link> {
  const link: Link = {
    id: crypto.randomUUID(),
    url: input.url,
    title: input.title,
    summary: null, // never populated synchronously
    status: 'unread',
    source: input.source,
    created_at: Date.now(),
    read_at: null,
  };

  await env.DB.prepare(
    `INSERT INTO links (id, url, title, summary, status, source, created_at, read_at)
     VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, NULL)`,
  )
    .bind(link.id, link.url, link.title, link.status, link.source, link.created_at)
    .run();

  return link;
}

export async function setStatus(env: Env, id: string, status: LinkStatus): Promise<Link | null> {
  const readAt = status === 'read' ? Date.now() : null;
  await env.DB.prepare('UPDATE links SET status = ?1, read_at = ?2 WHERE id = ?3')
    .bind(status, readAt, id)
    .run();
  return getLink(env, id);
}

export async function deleteLink(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare('DELETE FROM links WHERE id = ?1').bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function setSummary(env: Env, id: string, summary: string): Promise<void> {
  await env.DB.prepare('UPDATE links SET summary = ?1 WHERE id = ?2 AND summary IS NULL')
    .bind(summary, id)
    .run();
}

/** Rows the retry cron should pick up: still unsummarised, and settled. */
export async function findUnsummarised(
  env: Env,
  olderThanMs: number,
  limit: number,
): Promise<Link[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM links
      WHERE summary IS NULL AND created_at < ?1
      ORDER BY created_at DESC
      LIMIT ?2`,
  )
    .bind(Date.now() - olderThanMs, limit)
    .all<Link>();
  return results ?? [];
}

/** How many rows are still waiting — surfaced on the settings screen. */
export async function countUnsummarised(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM links WHERE summary IS NULL',
  ).first<{ n: number }>();
  return row?.n ?? 0;
}
