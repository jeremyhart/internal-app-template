# Recipes

## Add an API route

1. Add the request/response types to `src/shared/types.ts` first. Both halves
   import from there; the contract is not allowed to live in one of them.
2. Add the handler in `src/api/routes/`. Validate input, then call the repo.
   Throw `badRequest` / `notFound` from `lib/errors.ts` — never build the error
   envelope by hand.
3. Add the query to `src/api/lib/links.repo.ts`. Bound parameters only.
4. Add the method to `src/web/lib/api.ts`. Nothing else in the frontend calls
   `fetch`.

Access verification is already applied to the whole tree. There is nothing to
add per route, and nothing to remember.

## Add a feature flag

```ts
// src/api/lib/flags.ts
export const FLAG_MY_FEATURE = 'link-stash.my-feature';
```

```ts
if (await isEnabled(c.env, FLAG_MY_FEATURE)) { ... }
```

Default off. Turn it on without a deploy:

```sh
npx wrangler kv key put --binding CACHE flag:link-stash.my-feature true
```

Remove the flag once the feature is permanent — a flag that outlives its rollout
is debt (ADR-012).

## Add a migration

New numbered file in `migrations/`. Never edit an applied one.

```sh
npm run migrate:local    # then
npm run migrate:remote   # CI does this on merge to main
```

Two tables is the scope limit. A third is a product decision, not a migration.

## Change something in `src/web/ui/` or `tokens.css`

The pre-commit check blocks it. If the change is genuinely intended:

```sh
ALLOW_UI_EDIT=1 git commit ...
```

If a screen needs a component the inventory does not have, that is a
conversation about the inventory, not a new file in `screens/`.

## Work on summarisation

Do not point it at a live model. `wrangler dev` spends the same account-wide
daily Neuron allowance as production, silently. Extraction and response tidying
are pure functions with fixture coverage in `tests/summarise.test.ts` — change
them there.

## Find out whether the cron is alive

```sh
npx wrangler d1 execute link-stash --remote \
  --command "SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 20"
```

Nothing else will tell you. Cron Triggers do not retry and do not alert.
