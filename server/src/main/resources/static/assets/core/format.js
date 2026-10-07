export function plural(count, word) { return `${count} ${word}${count === 1 ? '' : 's'}`; }
export function formatDate(value, options = {dateStyle: 'medium'}) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T00:00:00`));
}
export function formatMoney(currency, amount) {
  try { return new Intl.NumberFormat(undefined, {style: 'currency', currency}).format(Number(amount)); }
  catch { return `${currency} ${amount}`; }
}
export function expiryText(days, date) {
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Expires today';
  return `Expires in ${days} days`;
}
export function clampMonthDate(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + Number(months), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}
