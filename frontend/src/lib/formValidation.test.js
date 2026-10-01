import { describe, expect, it } from 'vitest';
import { formatPriceInput, isValidPrice, normalizePrice } from './formValidation.js';

describe('price validation', () => {
  it.each(['5000', '5000.50', '5,000', '5,000.50'])('accepts %s', (value) => {
    expect(isValidPrice(value)).toBe(true);
  });

  it('rejects more than two decimal places', () => {
    expect(isValidPrice('5000.555')).toBe(false);
  });

  it('rejects malformed grouping', () => {
    expect(isValidPrice('50,00')).toBe(false);
  });

  it('adds thousands separators on blur and removes them for the API', () => {
    expect(formatPriceInput('5000.50')).toBe('5,000.50');
    expect(normalizePrice('5,000.50')).toBe('5000.50');
    expect(formatPriceInput('50,00')).toBe('50,00');
  });
});
