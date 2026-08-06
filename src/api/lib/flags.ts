import type { Env } from './env';

/**
 * Feature flags (ADR-012).
 *
 * Flagship stores flag values in Workers KV and evaluates them inside the
 * isolate via a native binding — no outbound HTTP, no SDK polling. Flagship was
 * still public beta as of May 2026, so evaluation is funnelled through this one
 * module: if the native binding is available it is a single-file swap, and
 * because Flagship is built on OpenFeature the evaluation shape is portable
 * either way.
 *
 * Convention: every non-trivial feature ships behind a flag, default off.
 * Toggling a flag must never require a deploy — hence KV, read per request.
 */

export const FLAG_SUMMARISATION = 'link-stash.summarisation';

const FLAG_CACHE_TTL_SECONDS = 60;

export async function isEnabled(env: Env, flag: string, fallback = false): Promise<boolean> {
  try {
    const value = await env.CACHE.get(`flag:${flag}`, {
      cacheTtl: FLAG_CACHE_TTL_SECONDS,
    });
    if (value === null) return fallback;
    return value === 'true' || value === '1' || value === 'on';
  } catch {
    // A flag store that cannot be read must not take the app down with it.
    // Default off is the safe direction for an optional feature.
    return fallback;
  }
}
