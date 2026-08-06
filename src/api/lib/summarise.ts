import type { Env } from './env';
import { FLAG_SUMMARISATION, isEnabled } from './flags';
import { setSummary } from './links.repo';

/**
 * Summarisation is never synchronous. The capture request writes the row with
 * `summary: null` and responds; this runs in `ctx.waitUntil()` afterwards.
 *
 * If any step fails, `summary` stays null. That is not an error state — it is a
 * row waiting for the retry cron.
 */

// Never parse a full document. The free-plan CPU budget is 10ms; model and
// network wait does not count toward it, but parsing does. Truncate first.
const MAX_HTML_BYTES = 20 * 1024;
const FETCH_TIMEOUT_MS = 8000;

// A small model, deliberately. The Neuron allocation is account-wide and shared
// across every model and every app on the account (ADR-011).
const MODEL = '@cf/meta/llama-3.2-1b-instruct';

// ADR-011 non-negotiable: a spend cap on every AI path. The Neuron pool is a
// fleet limit, not an app limit, so this app caps its own share rather than
// racing the others to 00:00 UTC.
const DAILY_CALL_BUDGET = 200;

const PROMPT_SYSTEM =
  'You summarise web pages. Reply with exactly one sentence describing what the page is about. ' +
  'No preamble, no quotes, no bullet points, no "This page". Under 30 words.';

function budgetKey(): string {
  // Resets at 00:00 UTC, matching the Neuron allocation window.
  return `neurons:${new Date().toISOString().slice(0, 10)}`;
}

async function claimBudget(env: Env): Promise<boolean> {
  const key = budgetKey();
  const used = Number((await env.CACHE.get(key)) ?? '0');
  if (used >= DAILY_CALL_BUDGET) return false;
  // Not atomic — KV has no counters. A solo-user app tolerates the slop; the
  // cap exists to bound a runaway, not to be exact.
  await env.CACHE.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}

/** Fetch at most MAX_HTML_BYTES of the page, giving up quickly. */
export async function fetchHtmlHead(url: string): Promise<string | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: abort.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkStash/1.0; +https://link-stash.invalid)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok || !res.body) return null;

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    await reader.cancel().catch(() => {});

    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, MAX_HTML_BYTES));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&(?:amp|#38);/g, '&')
    .replace(/&(?:lt|#60);/g, '<')
    .replace(/&(?:gt|#62);/g, '>')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:#39|apos|rsquo|#8217);/g, "'")
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/&(?:mdash|#8212);/g, '—');
}

function metaContent(html: string, attr: 'property' | 'name', value: string): string | null {
  // Both attribute orders occur in the wild, so try each rather than parsing.
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    const content = match?.[1]?.trim();
    if (content) return decodeEntities(content);
  }
  return null;
}

export function extractTitle(html: string): string | null {
  const og = metaContent(html, 'property', 'og:title');
  if (og) return og;

  const titleTag = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1]?.trim();
  return titleTag ? decodeEntities(titleTag) : null;
}

/** og:description, then meta description, then stripped body text. */
export function extractText(html: string): string | null {
  const meta =
    metaContent(html, 'property', 'og:description') ??
    metaContent(html, 'name', 'description');
  if (meta && meta.length > 40) return meta;

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(body).replace(/\s+/g, ' ').trim();

  if (text.length < 80) return meta ?? null;
  return text.slice(0, 3000);
}

export async function generateSummary(env: Env, title: string | null, text: string) {
  const response = (await env.AI.run(
    MODEL,
    {
      max_tokens: 80,
      messages: [
        { role: 'system', content: PROMPT_SYSTEM },
        {
          role: 'user',
          content: `Title: ${title ?? '(none)'}\n\nPage text:\n${text}`,
        },
      ],
    },
    {
      // Inherited standard: AI goes through AI Gateway, which is where caching,
      // rate limiting and the spend cap live. Never a raw call to a model.
      gateway: { id: 'internal-platform', skipCache: false, cacheTtl: 60 * 60 * 24 },
    },
    // The Workers AI types vary by @cloudflare/workers-types version; the
    // response shape below is what we actually depend on.
  )) as { response?: string };

  return tidySentence(response?.response ?? '');
}

/** One sentence, no preamble, no wrapping quotes. */
export function tidySentence(raw: string): string | null {
  // Order matters: the preamble comes before the quotes ("Summary: "…""), so
  // strip it first and only then unwrap.
  let text = raw.trim().replace(/^(?:here(?:'s| is) (?:a |the )?)?(?:summary|sentence)\s*:\s*/i, '');
  text = text.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!text) return null;

  const firstSentence = /^[\s\S]*?[.!?](?=\s|$)/.exec(text)?.[0];
  text = (firstSentence ?? text).trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();

  if (text.length < 10) return null;
  if (text.length > 400) text = `${text.slice(0, 397).trimEnd()}…`;
  return text;
}

/**
 * The whole pipeline for one row. Resolves to true if a summary was written.
 * Never throws — callers run this in waitUntil() and from the cron.
 */
export async function summariseLink(
  env: Env,
  link: { id: string; url: string; title: string | null },
): Promise<boolean> {
  try {
    if (!(await isEnabled(env, FLAG_SUMMARISATION))) return false;
    if (!(await claimBudget(env))) return false;

    const html = await fetchHtmlHead(link.url);
    if (!html) return false;

    const text = extractText(html);
    if (!text) return false;

    const summary = await generateSummary(env, link.title ?? extractTitle(html), text);
    if (!summary) return false;

    await setSummary(env, link.id, summary);
    return true;
  } catch {
    // Leave summary null. The retry cron owns it from here.
    return false;
  }
}
