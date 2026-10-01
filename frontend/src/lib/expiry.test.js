import { describe, expect, it } from 'vitest';
import { computeExpiresOn, computeStatus } from './expiry.js';
import { parseBill } from './parseBill.js';
import { BRAND_DICTIONARY, PRODUCT_TYPE_DICTIONARY } from './ocr/dictionaries.js';

describe('expiry helpers', () => {
  it('computes end-of-month expiry dates', () => {
    const first = computeExpiresOn('2024-01-31', 1).toISOString().slice(0, 10);
    const second = computeExpiresOn('2024-02-29', 1).toISOString().slice(0, 10);
    expect(first).toBe('2024-02-29');
    expect(second).toBe('2024-03-29');
  });

  it('marks status correctly by timezone-aware relative days', () => {
    expect(computeStatus('2024-07-10', '2024-07-01', 30)).toBe('EXPIRING_SOON');
    expect(computeStatus('2024-07-10', '2024-07-05', 30)).toBe('EXPIRING_SOON');
    expect(computeStatus('2024-07-10', '2024-07-11', 30)).toBe('EXPIRED');
  });
});

describe('parseBill', () => {
  const fixtures = [
    {
      text: 'Invoice Date: 12/03/2024\nTotal: ₹ 48999.00\nSamsung Split AC',
      expected: { purchaseDate: '2024-03-12', amount: '48999.00', brand: 'Samsung', productType: 'AC' }
    },
    {
      text: 'Date: 12-03-24\nGrand Total INR 28500\nLG Refrigerator',
      expected: { purchaseDate: '2024-03-12', amount: '28500', brand: 'LG', productType: 'Refrigerator' }
    },
    {
      text: 'bill date 12 Mar 2024\nAmount Payable Rs 24990\nPhilips Air Conditioner',
      expected: { purchaseDate: '2024-03-12', amount: '24990', brand: 'Philips', productType: 'AC' }
    },
    {
      text: 'Invoice Date: March 12, 2024\nNet Amount $899.00\nBosch Washing Machine',
      expected: { purchaseDate: '2024-03-12', amount: '899.00', brand: 'Bosch', productType: 'Washing Machine' }
    },
    {
      text: 'Model: RS-28\nSerial No: 4521-7788\nWarranty 24 months',
      expected: { modelName: 'RS-28', serialNumber: '4521-7788', warrantyMonths: '24' }
    },
    {
      text: 'MRP: ₹ 12999\nSony TV',
      expected: { amount: '12999', brand: 'Sony', productType: 'Television' }
    },
    {
      text: 'MRP: ₹ 50,000\nSub Total: ₹ 45,000\nDiscount: ₹ 5,000\nTotal: ₹ 40,000',
      expected: { amount: '40000' }
    },
    {
      text: 'MRP: ₹ 50,000\nSubtotal: ₹ 45,000\nDiscount: ₹ 5,000',
      expected: { amount: '50000' }
    },
    {
      text: 'Date: 01/04/2023\nTotal 9999.99\nPanasonic Microwave Oven',
      expected: { purchaseDate: '2023-04-01', amount: '9999.99', brand: 'Panasonic', productType: 'Microwave' }
    },
    {
      text: 'Bill Date: 20-06-2022\nTotal: 34500\nWhirlpool Fridge',
      expected: { purchaseDate: '2022-06-20', amount: '34500', brand: 'Whirlpool', productType: 'Refrigerator' }
    },
    {
      text: 'Invoice date: 09/09/2025\nGrand Total: ₹ 48000\nModel no: F9-Q10',
      expected: { purchaseDate: '2025-09-09', amount: '48000', modelName: 'F9-Q10' }
    },
    {
      text: 'Date: 15 Oct 2021\nAmount Payable INR 7600\nAcer Laptop',
      expected: { purchaseDate: '2021-10-15', amount: '7600', brand: 'Acer' }
    },
    {
      text: 'Warranty 2 years\nDell monitor',
      expected: { warrantyMonths: '24', brand: 'Dell' }
    },
    {
      text: 'Total: 29,999\nModel No: 4001-L\nSerial number: U370',
      expected: { amount: '29999', modelName: '4001-L', serialNumber: 'U370' }
    }
  ];

  it.each(fixtures)('parses a realistic bill fixture', ({ text, expected }) => {
    const parsed = parseBill(text, { today: new Date('2026-09-30T00:00:00Z') });
    for (const [key, value] of Object.entries(expected)) {
      expect(parsed[key]).toContain(value);
    }
  });

  it('uses the locale hint for ambiguous numeric dates and rejects future and stale dates', () => {
    const today = new Date('2026-09-30T00:00:00Z');
    expect(parseBill('Invoice Date: 03/04/2024', { today }).purchaseDate).toBe('2024-04-03');
    expect(parseBill('Date: 03/04/2024', { localeHint: 'en-US', today }).purchaseDate).toBe('2024-03-04');
    expect(parseBill('Date: 01/01/2030', { today }).purchaseDate).toBe('');
    expect(parseBill('Date: 01/01/1990', { today }).purchaseDate).toBe('');
    expect(parseBill('Date: 31/02/2024', { today }).purchaseDate).toBe('');
  });

  it('contains the required broad brand and product-type dictionaries', () => {
    expect(new Set(BRAND_DICTIONARY.map(([brand]) => brand)).size).toBeGreaterThanOrEqual(120);
    expect(new Set(PRODUCT_TYPE_DICTIONARY.map(([type]) => type)).size).toBeGreaterThanOrEqual(60);
    expect(parseBill('ACME invoice; double door fridge').productType).toBe('Refrigerator');
    expect(parseBill('BOSCH 2 years comprehensive warranty').warrantyMonths).toBe('24');
  });

  it('deduplicates dictionary labels and matches the most specific overlapping brand', () => {
    for (const dictionary of [BRAND_DICTIONARY, PRODUCT_TYPE_DICTIONARY]) {
      const normalizedLabels = dictionary.map(([label]) => label.toLowerCase().replace(/[^a-z0-9]/g, ''));
      expect(new Set(normalizedLabels).size).toBe(normalizedLabels.length);
      expect(dictionary.every(([, variants]) => (
        new Set(variants.map((variant) => variant.trim().toLowerCase())).size === variants.length
      ))).toBe(true);
    }
    expect(parseBill('Godrej Interio chair').brand).toBe('Godrej Interio');
  });

  it('does not detect a brand embedded inside an unrelated word', () => {
    expect(parseBill('Bulgarian-made appliance with a one-year warranty').brand).toBe('');
  });

  it('chooses the first whole brand mention when a receipt names multiple brands', () => {
    expect(parseBill('Bosch vacuum, compatible with Samsung accessories').brand).toBe('Bosch');
  });

  it('requires contextual or capitalized evidence for the ambiguous Nothing brand', () => {
    expect(parseBill('Nothing to declare').brand).toBe('');
    expect(parseBill('brand: nothing').brand).toBe('Nothing');
    expect(parseBill('NOTHING phone').brand).toBe('Nothing');
    expect(parseBill('Nothing Phone (2a)').brand).toBe('Nothing');
  });
});
