# Link Stash

Save a link from an Android phone. Read it on a laptop. Each link gets a
one-sentence AI summary so the list is scannable without opening anything.

Single user. No sharing, no collaboration, no accounts — sign-in is Cloudflare
Access, and there is no auth code in this repo beyond verifying its assertion.

This is app one on the internal platform. It exists to prove the platform, which
is why it is small.

---

## Shape

| Piece | What |
|---|---|
| `src/web/` | React + Vite SPA on Cloudflare Pages. A PWA, so it is installable and appears in the Android share sheet. |
| `src/api/` | Hono on Cloudflare Workers. Also owns the Cron Trigger. |
| `src/shared/` | The API contract and the pure helpers both halves need. |
| `migrations/` | D1. Two tables: `links`, `cron_runs`. |

Everything scales to zero. Nothing here has an idle cost.

## How a link gets in

1. Android share sheet → the manifest's **GET** share target at `/share`.
2. `/share` is a normal page load, so an expired Access session re-authenticates
   the way any navigation does.
3. The page pulls the URL out of whichever param actually carried it and POSTs
   to `/api/links` same-origin, with the Access cookie attached.
4. The row is written with `summary: null` and the response returns. Nothing
   waits on the model.
5. Summarisation runs in `ctx.waitUntil()` afterwards. If it fails, the summary
   stays null and the retry cron picks it up.

The share target is GET on purpose. A POST target is handled inside the service
worker, and a service worker POST against an expired Access session receives an
HTML login redirect rather than a response — which it cannot do anything with.

## Running it

```sh
npm install

npm run migrate:local     # apply migrations to the local D1
npm run dev:api           # Worker on :8787
npm run dev               # SPA on :5173, proxying /api to the Worker
```

**Local iteration does not call Workers AI.** `wrangler dev` draws on the same
account-wide Neuron allocation as production, so summarisation is exercised
against `tests/fixtures/article.html` in the test suite instead. If you need a
live call, turn the flag on deliberately and expect it to cost budget the rest
of the fleet shares.

```sh
npm run typecheck && npm run lint && npm test && npm run build
```

Enable the boundary checks locally once:

```sh
git config core.hooksPath .githooks
```

## Deploying it

CI deploys on merge to `main`. First time on a fresh account, in order:

```sh
# 1. Resources
npx wrangler d1 create link-stash
npx wrangler kv namespace create CACHE

# 2. Fill the placeholders in wrangler.jsonc:
#    {DOMAIN} {TEAM} {ACCESS_AUD} {D1_DATABASE_ID} {KV_CACHE_ID}

# 3. Schema
npm run migrate:remote

# 4. Ship
npm run deploy:api
npm run build && npm run deploy:web
```

Then, in the dashboard:

- An Access application on **both** `link-stash.{DOMAIN}` and
  `link-stash-api.{DOMAIN}`. Copy the AUD tag into `wrangler.jsonc`.
- Confirm `workers_dev` is off — it is set to `false` in `wrangler.jsonc`, and
  the point of it is that the Worker is not reachable outside Access.
- An AI Gateway named `internal-platform`, with a spend cap and rate limits.

### The summarisation flag

Summarisation is the optional half of this app and ships behind a flag, default
off (ADR-012). Toggling it is not a deploy:

```sh
npx wrangler kv key put --binding CACHE flag:link-stash.summarisation true
npx wrangler kv key put --binding CACHE flag:link-stash.summarisation false
```

With the flag off, links still save and the list still works — rows simply say
"No summary" instead of waiting for one.

## Watching it

Cron Triggers do not retry and do not alert, so the only evidence a sweep ran is
the row it writes:

```sh
npx wrangler d1 execute link-stash --remote \
  --command "SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 20"
```

A run with a non-null `error`, or a gap in `started_at`, is the failure signal.
Nothing else will tell you. The settings screen surfaces the count of links
still waiting for a summary, which is the same signal from the other end.

## Not in scope

Full-text extraction. Offline reading. Article storage in R2. Tags. Search.
Multi-user. Any third table.
