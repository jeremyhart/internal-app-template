import { Hono } from 'hono';
import { requireAccess } from './lib/access';
import { runRetrySweep } from './lib/cron';
import type { AppContext, Env } from './lib/env';
import { HttpError, fail } from './lib/errors';
import { FLAG_SUMMARISATION, isEnabled } from './lib/flags';
import { countUnsummarised } from './lib/links.repo';
import { links } from './routes/links';

const app = new Hono<AppContext>().basePath('/api');

// Identity contract: applied to the entire tree before any handler, so there is
// no route that can be added later without it.
app.use('*', requireAccess);

app.route('/links', links);

/** Everything the settings screen needs, without adding a table. */
app.get('/status', async (c) =>
  c.json({
    app: c.env.APP_NAME,
    user: c.get('userEmail'),
    summarisation_enabled: await isEnabled(c.env, FLAG_SUMMARISATION),
    pending_summaries: await countUnsummarised(c.env),
  }),
);

app.notFound((c) => fail(c, 404, 'not_found', 'No such route'));

app.onError((err, c) => {
  if (err instanceof HttpError) return fail(c, err.status, err.code, err.message);
  console.error('unhandled', err);
  return fail(c, 500, 'internal_error', 'Something went wrong');
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runRetrySweep(env));
  },
} satisfies ExportedHandler<Env>;
