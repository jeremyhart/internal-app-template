# Architecture — Link Stash

## Map

```
src/shared/       types.ts (the API contract), url.ts, time.ts
                  imported by BOTH halves; keep it pure and dependency-free

src/api/
  index.ts        Hono app, /api basePath, Access middleware, onError, scheduled()
  routes/links.ts GET/POST/PATCH/DELETE — validation only, no SQL
  lib/access.ts   Cf-Access-Jwt-Assertion verification (JWKS cached in KV)
  lib/links.repo.ts  the ONLY place env.DB is touched for links
  lib/summarise.ts   fetch → truncate → extract → model → update
  lib/flags.ts    Flagship/KV flag evaluation
  lib/cron.ts     retry sweep + cron_runs bookkeeping
  lib/errors.ts   HttpError + the { error: { code, message } } envelope
  lib/env.ts      bindings

src/web/
  main.tsx        root + service worker registration
  App.tsx         three routes: list, settings, share
  screens/        composed from ui/, never designing new components
  ui/             the component inventory — PROTECTED
  tokens.css      design tokens — PROTECTED
  lib/api.ts      the ONLY place the frontend calls fetch
```

## The two flows that matter

**Capture.** `/share` (GET) or the manual form → `POST /api/links` → row written
with `summary: null`, 201 returned → `ctx.waitUntil(summariseLink())`. The
response never waits on the model.

**Retry.** Cron every 10 min → insert `cron_runs` row → if the flag is on, take
up to 5 rows where `summary IS NULL AND created_at < now - 5min` → summarise
sequentially → update `cron_runs` with count and error. The row is written even
when the sweep throws.

## Invariants

- No route exists outside the Access middleware.
- Summarisation never blocks a response.
- HTML is truncated to 20KB before any parsing (10ms CPU budget).
- A failure anywhere in summarisation leaves `summary` null and returns false.
- Two tables, ever.
