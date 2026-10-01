function dateFromValue(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, locale) {
  const date = dateFromValue(value);
  if (!date) return value || '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function formatDateTime(value, locale) {
  const date = dateFromValue(value);
  if (!date) return value || '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatCurrency(value, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${value} ${currency}`;
  }
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currencySymbol(currency, locale) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((part) => part.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}
