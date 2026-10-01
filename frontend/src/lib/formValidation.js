export function isValidPrice(value) {
  return /^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?$/.test(String(value));
}

export function normalizePrice(value) {
  return String(value).replaceAll(',', '');
}

export function formatPriceInput(value) {
  if (!isValidPrice(value)) return String(value);
  const normalized = normalizePrice(value);
  const [whole, fraction] = normalized.split('.');
  const formattedWhole = Number(whole).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return fraction === undefined ? formattedWhole : `${formattedWhole}.${fraction}`;
}
