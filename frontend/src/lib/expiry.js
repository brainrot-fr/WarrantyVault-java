function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Date must use YYYY-MM-DD format');
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError('Date is invalid');
  }
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function computeExpiresOn(purchasedOn, warrantyMonths) {
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 1 || warrantyMonths > 120) {
    throw new RangeError('Warranty period must be between 1 and 120 months');
  }
  const date = parseDate(purchasedOn);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + warrantyMonths);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

export function computeStatus(expiresOn, today) {
  const diff = Math.floor((parseDate(expiresOn) - parseDate(today)) / 86_400_000);
  if (diff < 0) return 'EXPIRED';
  if (diff <= 30) return 'EXPIRING_SOON';
  return 'ACTIVE';
}
