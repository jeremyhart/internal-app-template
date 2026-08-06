# Notes from building app one

The brief asked for a list of anything that felt like it should already have
been decided. This is that list. It is the template's first specification.

Ordered by how much it cost to work around.

---

## 1. The API cannot live only on `<name>-api.{DOMAIN}`

**Standards §2** fixes the API hostname as `link-stash-api.{DOMAIN}`. The brief
requires the SPA to call the API "same-origin with the session cookie attached",
and it is right to: a cross-origin call to a second Access-protected hostname
answers an expired session with an HTML login redirect that the browser turns
into an opaque CORS failure. The user sees a broken screen, which is exactly the
acceptance criterion that forbids it.

**What I did.** One Worker, two routes: the conventional `link-stash-api.{DOMAIN}`
custom domain, and `link-stash.{DOMAIN}/api/*` on the zone so the SPA's calls are
same-origin. Both hostnames need an Access application.

**What the template needs.** A decision on whether the app hostname always
carries `/api/*`, and if so whether the separate API hostname earns its keep at
all. Right now the naming convention and the cookie model pull in opposite
directions, and every app will hit this on day one.

## 2. Per-app Cron Triggers versus the scheduler Worker

**ADR-006** says one scheduler Worker owns all Cron Triggers. The brief gives
this app its own trigger and its own `cron_runs` table. Both cannot be the rule.

It matters arithmetically: the free-tier cap is 5 Cron Triggers per account (and
ADR-006 itself notes Cloudflare's docs contradict this). At one trigger per app,
the platform runs out of scheduling at app five — well before it runs out of D1
databases at ten.

**What I did.** Followed the brief: the trigger and `cron_runs` live in this app.

**What the template needs.** Either the scheduler Worker exists and apps expose
a retry endpoint for it to call, or per-app triggers are the rule and ADR-006 is
narrowed to the export job. `cron_runs` should also be a shared shape, not a
table each app invents — if a fleet report ever gets built (ADR-008), it will
want to read all of them the same way.

## 3. Flagship has no recipe, and possibly no binding

**ADR-012** mandates Flagship and forbids hardcoded booleans, but Flagship was
public beta as of May 2026 and the ADR says to verify before depending on it. I
could not verify the native binding from here.

**What I did.** All flag evaluation goes through `src/api/lib/flags.ts`, reading
`flag:<name>` keys from the KV namespace with a short `cacheTtl`. If the native
binding is real, it is a one-file swap; because Flagship is OpenFeature-based,
the evaluation shape survives either way.

**What the template needs.** The verified answer, plus a flag naming convention.
I used `link-stash.summarisation` (app-prefixed) because flags share a KV
namespace, but that is a guess.

## 4. Neuron budget per app is still open — and I had to pick a number

**ADR-011** flags this as unresolved and it became load-bearing immediately. The
pool is account-wide; one chatty app starves the rest and, on the free plan,
requests fail until 00:00 UTC.

**What I did.** Capped this app at 200 model calls per UTC day, counted in KV.
The counter is not atomic — KV has no counters — which is fine for one user but
would not be for a busier app.

**What the template needs.** A real policy: a per-app share, and where the
counter lives. If the answer is Durable Objects, that has to be written down,
because a naive DO counter is a standing cost (ADR-003).

## 5. The component inventory did not exist, so I invented one

This is already open in §6 of the standards, and it is the item that blocks the
template most directly: the template cannot constrain anything until the design
system exists. I wrote `src/web/ui/` and `tokens.css` as a small working
inventory — button, field, card, badge, notice, empty state, app bar, definition
list — because the app needed screens. It is a starting point, not a decision.

**What the template needs.** Jeremy, once, as the standards already say.

## 6. ADR-004 has no implementation path yet

Time Travel is on by default, so recovery is covered. Retention is not: the R2
export is driven by the scheduler Worker, and the scheduler Worker does not
exist. App one therefore has no export and no restore drill.

**What the template needs.** This is fine for one app and not fine for a fleet.
It should be built before app two, not after app five.

## 7. Small things with no standard, decided here by default

Each of these is a coin-flip I made alone. None is hard; all of them will differ
per app if nobody writes them down.

- **Error code vocabulary.** The envelope shape is standardised; the codes
  inside it are not. I used `bad_request`, `unauthorized`, `not_found`,
  `internal_error`.
- **Pagination.** No standard. I capped list responses at 500 rows and did not
  paginate, because this app cannot outgrow that. Most apps can.
- **SPA routing.** No standard router, and no standard Pages SPA fallback. I
  hand-rolled a three-route switch and a `_redirects` file.
- **Freshness.** "Summary arrives without a refresh" needs a mechanism. I poll
  every 6s, only while something is pending and only while the tab is visible.
  The alternatives (SSE, a DO) both cost more than this app is worth — but the
  choice should be a platform default, not a per-app invention.
- **Worker integration testing.** The suite here is unit-level: URL extraction,
  HTML extraction, response tidying, and JWT verification against a generated
  keypair. There is no standard harness for testing a Worker with real D1
  bindings, so routes are covered by types and by hand.
- **Formatter.** Not specified. I ran with ESLint alone rather than adding a
  Prettier config that the next app might contradict.
- **AI Gateway naming.** I used one gateway, `internal-platform`, shared across
  apps so the spend cap is a fleet cap. Per-app gateways would give per-app
  caps. Unspecified either way.
- **`cron_runs` retention.** Nothing prunes it. At one row per ten minutes it is
  ~52k rows a year — harmless here, but it is the kind of table that quietly
  becomes the largest thing in a 500 MB database.

## 8. What went right, and should be kept verbatim

- **The GET share target reasoning.** It is correct and non-obvious, and it is
  the single thing most likely to be got wrong by an agent that has not been
  told. It belongs in the template as a worked example with the comment intact.
- **`summary: null` as a legitimate state.** Modelling the failure as "a row
  waiting" rather than an error removed an entire error-handling surface from
  both halves of the app.
- **Access verification as middleware on the whole tree.** There is no route
  that can be added later without it. This should be the template's shape, not
  a per-route decorator.
- **The plugin does not exist yet**, so nothing here is version-pinned to it
  (ADR-007). The boundary checks live in `scripts/check-boundaries.sh` and will
  need to move into the plugin rather than be copied into app two.
