import { describe, expect, it } from 'vitest';
import { cleanTitle, extractUrl, hostnameOf, isHttpUrl } from '../src/shared/url';

describe('extractUrl', () => {
  it('takes url when Android populates it properly', () => {
    expect(extractUrl('https://example.com/a', null, 'A title')).toBe('https://example.com/a');
  });

  it('finds the URL in text, which is where Chrome on Android usually puts it', () => {
    expect(extractUrl(null, 'https://example.com/post', 'A title')).toBe(
      'https://example.com/post',
    );
  });

  it('finds a URL appended to shared text', () => {
    expect(extractUrl(null, 'Look at this https://example.com/post it is good', null)).toBe(
      'https://example.com/post',
    );
  });

  it('falls back to a URL stuck on the end of the title', () => {
    expect(extractUrl(null, null, 'Some Article — https://example.com/x')).toBe(
      'https://example.com/x',
    );
  });

  it('ignores an empty url param rather than trusting it', () => {
    expect(extractUrl('', 'https://example.com/y', '')).toBe('https://example.com/y');
  });

  it('trims trailing punctuation that rides along', () => {
    expect(extractUrl(null, 'read this: https://example.com/z.', null)).toBe(
      'https://example.com/z',
    );
  });

  it('returns null when the share carries no link', () => {
    expect(extractUrl(null, 'just some text', 'a title')).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(extractUrl('javascript:alert(1)', null, null)).toBeNull();
    expect(isHttpUrl('ftp://example.com')).toBe(false);
  });
});

describe('cleanTitle', () => {
  it('drops a title that is just the URL', () => {
    expect(cleanTitle('https://example.com/a', 'https://example.com/a')).toBeNull();
  });

  it('strips the URL out of a title that carries both', () => {
    expect(cleanTitle('Some Article — https://example.com/a', 'https://example.com/a')).toBe(
      'Some Article',
    );
  });

  it('keeps a real title', () => {
    expect(cleanTitle('Some Article', 'https://example.com/a')).toBe('Some Article');
  });

  it('returns null for a missing title', () => {
    expect(cleanTitle(null, 'https://example.com/a')).toBeNull();
  });
});

describe('hostnameOf', () => {
  it('strips www', () => {
    expect(hostnameOf('https://www.example.com/a')).toBe('example.com');
  });

  it('returns the input when it cannot parse', () => {
    expect(hostnameOf('nonsense')).toBe('nonsense');
  });
});
