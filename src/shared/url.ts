/**
 * Android sends the shared URL inconsistently. Chrome frequently places it in
 * `text` rather than `url`, and some apps append it to `title`. So: extract the
 * first valid URL found across all three params, in the order they are most
 * likely to hold a clean one. Never trust `url` to be populated.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/i;

export function isHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Strips trailing punctuation that commonly rides along in shared text. */
function trimTrailingJunk(candidate: string): string {
  return candidate.replace(/[.,;:!?)\]}'"]+$/, '');
}

export function extractUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;

    const whole = trimTrailingJunk(candidate.trim());
    if (isHttpUrl(whole)) return whole;

    const match = URL_PATTERN.exec(candidate);
    if (match) {
      const found = trimTrailingJunk(match[0]);
      if (isHttpUrl(found)) return found;
    }
  }
  return null;
}

/**
 * The title a share gives us is often the URL itself, or the URL with some
 * chrome around it. Returning null in that case lets the UI fall back to the
 * hostname, which reads better than a repeated link.
 */
export function cleanTitle(rawTitle: string | null | undefined, url: string): string | null {
  if (!rawTitle) return null;
  const stripped = rawTitle.replace(URL_PATTERN, '').trim().replace(/^[-–—|:\s]+|[-–—|:\s]+$/g, '');
  if (!stripped) return null;
  if (stripped === url) return null;
  return stripped;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
