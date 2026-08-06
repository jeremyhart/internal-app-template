#!/usr/bin/env sh
# Pre-commit boundary checks (ADR-009).
#
# Order of force: told not to < told how < given a recipe < given no alternative.
# These are the "no alternative" end. Anything not checked here will drift.

set -eu

fail=0
note() {
  printf '  %s\n' "$1" >&2
  fail=1
}

staged() {
  git diff --cached --name-only --diff-filter=ACM | grep -E "$1" || true
}

# 1. Raw fetch outside the API client and the summariser.
for file in $(staged '^src/(web|api)/.*\.(ts|tsx)$'); do
  case "$file" in
    # api.ts is the frontend's single network seam; the summariser fetches the
    # page being summarised; access.ts fetches the Access JWKS.
    src/web/lib/api.ts | src/api/lib/summarise.ts | src/api/lib/access.ts) continue ;;
  esac
  if grep -nE '(^|[^.\w])fetch\(' "$file" >/dev/null 2>&1; then
    note "raw fetch in $file — use src/web/lib/api.ts (frontend) or the summariser (backend)"
  fi
done

# 2. Direct env.DB / c.env.DB outside the data layer.
for file in $(staged '^src/api/.*\.(ts)$'); do
  case "$file" in
    src/api/lib/links.repo.ts | src/api/lib/cron.ts) continue ;;
  esac
  if grep -nE 'env\.DB' "$file" >/dev/null 2>&1; then
    note "direct env.DB in $file — go through src/api/lib/links.repo.ts"
  fi
done

# 3. Hardcoded feature booleans instead of a Flagship flag (ADR-012).
for file in $(staged '^src/.*\.(ts|tsx)$'); do
  if grep -nE 'const [A-Z_]*(ENABLE|FEATURE)[A-Z_]* *= *(true|false)' "$file" >/dev/null 2>&1; then
    note "hardcoded feature boolean in $file — use src/api/lib/flags.ts"
  fi
done

# 4. Protected paths: the component inventory and the design tokens.
for file in $(staged '^(src/web/ui/|src/web/tokens\.css)'); do
  if [ -z "${ALLOW_UI_EDIT:-}" ]; then
    note "$file is the protected inventory — set ALLOW_UI_EDIT=1 if this is a deliberate change"
  fi
done

# 5. Arbitrary colour and spacing values outside tokens.css.
for file in $(staged '^src/web/.*\.css$'); do
  [ "$file" = "src/web/tokens.css" ] && continue
  if grep -nE ':[^;]*(#[0-9a-fA-F]{3,8}\b|rgb\()' "$file" >/dev/null 2>&1; then
    note "raw colour in $file — add a token to tokens.css instead"
  fi
done

if [ "$fail" -ne 0 ]; then
  printf '\nBoundary check failed.\n' >&2
  exit 1
fi
