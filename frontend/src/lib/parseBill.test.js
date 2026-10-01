import { describe, expect, it } from 'vitest';
import { parseBill } from './parseBill.js';

const today = new Date('2026-10-01T12:00:00.000Z');

const billFixtures = [
  {
    name: 'Indian invoice with labeled date, model, serial, and final amount',
    text: 'INVOICE DATE: 01/09/2026\nSamsung Refrigerator\nModel: RT28T3922S8\nS/N: ABCD1234\nGrand Total: ₹ 42,990.00',
    expected: { purchaseDate: '2026-09-01', amount: '42990.00', brand: 'Samsung', productType: 'Refrigerator', modelName: 'RT28T3922S8', serialNumber: 'ABCD1234' }
  },
  {
    name: 'US invoice with month-first numeric date',
    text: 'Bill Date: 09/01/2026\nApple Laptop\nAmount Payable: $1,299.99',
    options: { localeHint: 'en-US' },
    expected: { purchaseDate: '2026-09-01', amount: '1299.99', brand: 'Apple', productType: 'Laptop' }
  },
  {
    name: 'long month date from a home appliance receipt',
    text: 'Purchase date: 1 September 2026\nWhirlpool Washing Machine\nTotal: INR 38,500',
    expected: { purchaseDate: '2026-09-01', amount: '38500', brand: 'Whirlpool', productType: 'Washing Machine' }
  },
  {
    name: 'purchase label takes precedence over a delivery date',
    text: 'Order placed: 28/08/2026\nDate of Purchase: 01/09/2026\nSony Television',
    expected: { purchaseDate: '2026-09-01', brand: 'Sony', productType: 'Television' }
  },
  {
    name: 'rejects future invoice dates',
    text: 'Invoice Date: 03/10/2026\nBosch Microwave',
    expected: { purchaseDate: '', brand: 'Bosch', productType: 'Microwave' }
  },
  {
    name: 'rejects impossible calendar dates',
    text: 'Bill Date: 30/02/2026\nLG air conditioner',
    expected: { purchaseDate: '', brand: 'LG', productType: 'AC' }
  },
  {
    name: 'normalizes two digit years in the current century',
    text: 'Purchase Date: 1/9/26\nSamsung refrigerator',
    expected: { purchaseDate: '2026-09-01' }
  },
  {
    name: 'chooses amount payable over subtotal',
    text: 'Subtotal: ₹ 12,000.00\nAmount Payable: ₹ 13,450.00',
    expected: { amount: '13450.00' }
  },
  {
    name: 'reads a US dollar grand total',
    text: 'Sony television\nGrand Total: $1,299.99',
    expected: { amount: '1299.99', brand: 'Sony', productType: 'Television' }
  },
  {
    name: 'converts manufacturer warranty years to months',
    text: 'Apple Laptop\n2 years comprehensive warranty',
    expected: { brand: 'Apple', productType: 'Laptop', warrantyMonths: '24' }
  },
  {
    name: 'reads an explicit warranty period in months',
    text: 'LG Microwave\nWarranty period: 18 months',
    expected: { brand: 'LG', productType: 'Microwave', warrantyMonths: '18' }
  },
  {
    name: 'does not mistake ordinary text for the Nothing brand',
    text: 'Nothing to declare. Sony television, model OLED-55A1.',
    expected: { brand: 'Sony', productType: 'Television', modelName: 'OLED-55A1' }
  }
];

describe('parseBill', () => {
  it.each(billFixtures)('parses $name', ({ text, options, expected }) => {
    expect(parseBill(text, { today, ...options })).toMatchObject(expected);
  });
});
