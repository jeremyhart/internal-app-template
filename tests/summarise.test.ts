import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractText, extractTitle, tidySentence } from '../src/api/lib/summarise';

// Local iteration runs against this fixture, never a live model call:
// `wrangler dev` draws on the same account-wide Neuron allocation as
// production, so testing against the real thing burns the daily budget for
// every app on the account (ADR-011).
const article = readFileSync(new URL('./fixtures/article.html', import.meta.url), 'utf8');

describe('extractTitle', () => {
  it('prefers og:title', () => {
    expect(extractTitle(article)).toBe('The Cost of a Standing Database');
  });

  it('falls back to <title> and decodes entities', () => {
    const html = '<html><head><title>A &amp; B</title></head></html>';
    expect(extractTitle(html)).toBe('A & B');
  });

  it('returns null with nothing to work from', () => {
    expect(extractTitle('<html><body>hi</body></html>')).toBeNull();
  });
});

describe('extractText', () => {
  it('prefers og:description over meta description', () => {
    expect(extractText(article)).toMatch(/^Why an always-on database quietly becomes/);
  });

  it('falls back to meta description', () => {
    const html = '<meta name="description" content="A description long enough to be worth using.">';
    expect(extractText(html)).toBe('A description long enough to be worth using.');
  });

  it('falls back to body text with script and style removed', () => {
    const html = `
      <html><head><style>body{color:red}</style><script>var x = "hidden text here";</script></head>
      <body><p>The visible paragraph is long enough to clear the minimum threshold for
      body text extraction and should be what we get back.</p></body></html>`;
    const text = extractText(html);
    expect(text).toContain('The visible paragraph');
    expect(text).not.toContain('hidden text here');
    expect(text).not.toContain('color:red');
  });

  it('returns null when there is nothing usable', () => {
    expect(extractText('<html><body><p>hi</p></body></html>')).toBeNull();
  });

  it('caps the text it hands to the model', () => {
    const html = `<body><p>${'word '.repeat(5000)}</p></body>`;
    expect(extractText(html)!.length).toBeLessThanOrEqual(3000);
  });
});

describe('tidySentence', () => {
  it('keeps a single clean sentence', () => {
    expect(tidySentence('A guide to running internal apps on Cloudflare.')).toBe(
      'A guide to running internal apps on Cloudflare.',
    );
  });

  it('takes only the first sentence when the model rambles', () => {
    expect(tidySentence('First sentence here. Second one follows.')).toBe('First sentence here.');
  });

  it('strips wrapping quotes and a preamble', () => {
    expect(tidySentence('Summary: "A short description of the page."')).toBe(
      'A short description of the page.',
    );
  });

  it('rejects an empty or trivially short response', () => {
    expect(tidySentence('   ')).toBeNull();
    expect(tidySentence('Sure.')).toBeNull();
  });

  it('truncates a runaway response', () => {
    const result = tidySentence('x'.repeat(600))!;
    expect(result.length).toBeLessThanOrEqual(400);
    expect(result.endsWith('…')).toBe(true);
  });
});
