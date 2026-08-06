# CLAUDE.md

Closed questions only. Each points at an ADR in `internal-platform-standards.md`.
This is not a style guide — if something here reads like taste, delete it.

## Settled

| Question | Answer | Why |
|---|---|---|
| Where does auth live? | Nowhere in this repo. Cloudflare Access on the hostname; the Worker verifies `Cf-Access-Jwt-Assertion` and nothing else. | ADR-002 |
| Can a route skip JWT verification? | No. The middleware is applied to the whole `/api` tree, including endpoints that "aren't sensitive". | Standards §2 |
| Is `workers.dev` allowed? | No. `workers_dev: false`. Access on the custom hostname alone leaves the Worker directly reachable. | Standards §2 |
| Which database? | D1. Relational and queryable, scales to zero. | ADR-003 |
| Can I add a table? | No. `links` and `cron_runs`. A third table is a scope change, not an implementation detail. | Brief |
| Can summarisation be synchronous? | No. Write the row, respond, then `ctx.waitUntil()`. | Brief |
| Can I parse the full page HTML? | No. Truncate to 20KB first. The free-plan budget is 10ms of CPU; network wait is free, parsing is not. | ADR-005 |
| Which model? | A small one, via Workers AI, through AI Gateway. The Neuron pool is account-wide and shared with every other app. | ADR-011 |
| What happens when summarisation fails? | `summary` stays null. That is a valid state, not an error — the cron owns it from there. | Brief |
| Does the cron retry itself? | No. Cron Triggers do not retry. Every run writes to `cron_runs`; that table is the only failure signal. | ADR-006 |
| Can a feature ship without a flag? | No, not a non-trivial one. Default off, toggled without a deploy. | ADR-012 |
| Hardcoded feature boolean? | No. `src/api/lib/flags.ts`. | ADR-012 |
| Where can `fetch` be called? | `src/web/lib/api.ts` on the frontend, `src/api/lib/summarise.ts` on the backend. Nowhere else. | ADR-009 |
| Where can `env.DB` be touched? | `src/api/lib/links.repo.ts` and `src/api/lib/cron.ts`. | ADR-009 |
| Can I edit `src/web/ui/` or `tokens.css`? | Not incidentally. They are the inventory; the pre-commit check blocks it unless the change is deliberate. | ADR-009 |
| Can screens invent components? | No. Compose from `src/web/ui/`. If the inventory is missing something, that is a conversation, not a new file. | ADR-009 |
| Is the share target GET or POST? | GET. A POST target runs in the service worker, where an expired Access session returns an HTML login redirect instead of a response. | Brief |
| Can I trust the `url` share param? | No. Chrome on Android often puts the URL in `text`; some apps append it to `title`. Search all three. | Brief |
| Is `links.url` unique? | No, deliberately. Re-saving is allowed; the UI surfaces the duplicate rather than the API rejecting it. | Brief |
| Can I call Workers AI from `wrangler dev`? | Avoid it. It burns the same account-wide daily allowance as production. Use the fixture. | ADR-011 |

## Boundaries the hook enforces

`scripts/check-boundaries.sh` runs pre-commit. Anything not checked there will
eventually drift, so adding a standard means adding its check — or not adding
the standard.

## Still open

See `NOTES.md` for the decisions that turned out not to be settled while this
app was built. That list is the template's first specification.
