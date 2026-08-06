import { describe, expect, it } from 'vitest';
import { relativeTime } from '../src/shared/time';

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

describe('relativeTime', () => {
  it('reads as "just now" under a minute', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago');
    expect(relativeTime(NOW - 4 * 3_600_000, NOW)).toBe('4h ago');
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe('3d ago');
  });

  it('switches to a date past a week', () => {
    expect(relativeTime(NOW - 30 * 86_400_000, NOW)).toMatch(/Dec/);
  });

  it('does not produce negative times from a clock skew', () => {
    expect(relativeTime(NOW + 10_000, NOW)).toBe('just now');
  });
});
