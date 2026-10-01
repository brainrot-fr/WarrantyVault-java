import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDateTime } from './formatters.js';

describe('display formatting', () => {
  it('formats date-only values without shifting calendar days across time zones', () => {
    expect(formatDate('2026-01-02', 'en-US')).toBe('Jan 2, 2026');
  });

  it('formats valid timestamps and preserves invalid date input', () => {
    expect(formatDateTime('2026-01-02T12:00:00Z', 'en-US')).toContain('Jan 2, 2026');
    expect(formatDate('not-a-date', 'en-US')).toBe('not-a-date');
  });

  it('formats supported currencies and safely falls back for unsupported currency codes', () => {
    expect(formatCurrency('1250.5', 'USD', 'en-US')).toBe('$1,250.50');
    expect(formatCurrency('1250.5', 'XXX-NOT-CURRENCY', 'en-US')).toBe('1250.5 XXX-NOT-CURRENCY');
  });
});
