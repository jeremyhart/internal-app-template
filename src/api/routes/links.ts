import { Hono } from 'hono';
import type { AppContext } from '../lib/env';
import { badRequest, notFound } from '../lib/errors';
import { isHttpUrl } from '../../shared/url';
import type { CreateLinkBody, LinkStatus, UpdateLinkBody } from '../../shared/types';
import {
  createLink,
  deleteLink,
  getLink,
  listLinks,
  setStatus,
} from '../lib/links.repo';
import { summariseLink } from '../lib/summarise';

const STATUSES: LinkStatus[] = ['unread', 'read'];

export const links = new Hono<AppContext>();

links.get('/', async (c) => {
  const status = c.req.query('status');
  if (status !== undefined && !STATUSES.includes(status as LinkStatus)) {
    throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
  }
  return c.json(await listLinks(c.env, status as LinkStatus | undefined));
});

links.post('/', async (c) => {
  let body: CreateLinkBody;
  try {
    body = await c.req.json<CreateLinkBody>();
  } catch {
    throw badRequest('Body must be JSON');
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!isHttpUrl(url)) throw badRequest('url must be an http(s) URL');

  const source = body.source === 'share' ? 'share' : 'manual';
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;

  // url is deliberately not unique; a duplicate is created and the UI surfaces
  // it rather than the API rejecting the save.
  const link = await createLink(c.env, { url, title, source });

  // Never synchronous. The response has already been decided at this point.
  c.executionCtx.waitUntil(summariseLink(c.env, link));

  return c.json(link, 201);
});

links.patch('/:id', async (c) => {
  let body: UpdateLinkBody;
  try {
    body = await c.req.json<UpdateLinkBody>();
  } catch {
    throw badRequest('Body must be JSON');
  }
  if (!STATUSES.includes(body.status)) {
    throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
  }

  const existing = await getLink(c.env, c.req.param('id'));
  if (!existing) throw notFound('No such link');

  return c.json(await setStatus(c.env, existing.id, body.status));
});

links.delete('/:id', async (c) => {
  const deleted = await deleteLink(c.env, c.req.param('id'));
  if (!deleted) throw notFound('No such link');
  return c.body(null, 204);
});
