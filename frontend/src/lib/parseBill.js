import { BRAND_DICTIONARY, PRODUCT_TYPE_DICTIONARY } from './ocr/dictionaries.js';

const monthMap = new Map([
  ['jan', 1], ['january', 1], ['feb', 2], ['february', 2], ['mar', 3], ['march', 3],
  ['apr', 4], ['april', 4], ['may', 5], ['jun', 6], ['june', 6], ['jul', 7], ['july', 7],
  ['aug', 8], ['august', 8], ['sep', 9], ['sept', 9], ['september', 9], ['oct', 10],
  ['october', 10], ['nov', 11], ['november', 11], ['dec', 12], ['december', 12]
]);

function parseDateCandidate(raw, localeHint, today) {
  let year;
  let month;
  let day;
  let match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    year = normalizeYear(Number(match[3]), match[3].length, today);
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else if (/^en-US\b/i.test(localeHint)) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  } else {
    match = /^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i.exec(raw);
    if (match) {
      day = Number(match[1]);
      month = monthMap.get(match[2].toLowerCase());
      year = Number(match[3]);
    } else {
      match = /^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i.exec(raw);
      if (!match) return '';
      month = monthMap.get(match[1].toLowerCase());
      day = Number(match[2]);
      year = Number(match[3]);
    }
  }
  if (!month || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return '';
  const upperBound = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const lowerBound = Date.UTC(today.getUTCFullYear() - 30, today.getUTCMonth(), today.getUTCDate());
  if (parsed.getTime() > upperBound || parsed.getTime() < lowerBound) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizeYear(year, digits, today) {
  if (digits === 4) return year;
  const currentYear = today.getUTCFullYear();
  const century = Math.floor(currentYear / 100) * 100;
  const candidate = century + year;
  return candidate > currentYear ? candidate - 100 : candidate;
}

function labeledDateScore(text, index) {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  if (/\b(invoice\s+date|bill\s+date|purchase\s+date|date\s+of\s+purchase)\b[^:\n]{0,16}[:-]?\s*$/.test(before)) return 3;
  if (/\bdate\b[^:\n]{0,12}[:-]?\s*$/.test(before)) return 2;
  return 0;
}

function findPurchaseDate(text, localeHint, today) {
  const patterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b\d{1,2}\s+[a-z]{3,9}\s+\d{4}\b/gi,
    /\b[a-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/gi
  ];
  const candidates = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const date = parseDateCandidate(match[0], localeHint, today);
      if (date) candidates.push({ date, score: labeledDateScore(text, match.index), index: match.index });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates[0]?.date || '';
}

function findDictionaryValue(text, dictionary) {
  const candidates = dictionary.flatMap(([label, variants]) => variants.map((variant) => ({ label, variant })))
    .map((candidate) => ({
      ...candidate,
      match: findWholePhrase(text, candidate.variant)
    }))
    .filter((candidate) => candidate.match && isUnambiguousBrand(candidate, text))
    .sort((left, right) => left.match.index - right.match.index || right.variant.length - left.variant.length);
  return candidates[0]?.label || '';
}

function findWholePhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu').exec(text);
}

function isUnambiguousBrand(candidate, text) {
  if (candidate.label !== 'Nothing') return true;
  const { match } = candidate;
  if (/^nothing\s+to\s+declare\b/i.test(text.slice(match.index))) return false;
  if (match[0] === 'Nothing' || match[0] === 'NOTHING') return true;
  const context = text.slice(Math.max(0, match.index - 32), match.index + match[0].length + 32);
  return /\b(?:brand|make|model|sold\s+by)\b/i.test(context);
}

function findAmount(text) {
  const amountPattern = /\b(grand\s+total|amount\s+payable|net\s+amount|sub[\s-]*total|total|mrp)\b[\s:=-]{0,12}(?:(?:₹|inr|rs\.?|\$)\s*)?(\d[\d,]*(?:\.\d{1,2})?)/gi;
  const priority = {
    grandtotal: 5,
    amountpayable: 5,
    netamount: 4,
    total: 3,
    mrp: 1,
    subtotal: 0
  };
  const amounts = [...text.matchAll(amountPattern)]
    .map((match) => ({
      amount: match[2].replace(/,/g, ''),
      priority: priority[match[1].toLowerCase().replace(/[\s-]+/g, '')] ?? 0,
      index: match.index
    }))
    .filter(({ amount, priority: amountPriority }) => amountPriority > 0 && Number.isFinite(Number(amount)))
    .sort((left, right) => right.priority - left.priority || right.index - left.index);
  return amounts[0]?.amount || '';
}

function findWarrantyMonths(text) {
  const patterns = [
    /\bwarranty(?:\s+period|\s+coverage)?\s*(?:for|of|:|-)?\s*(\d{1,3})\s*(months?|years?)\b/i,
    /\b(\d{1,3})\s*(months?|years?)\s*(?:(?:comprehensive|manufacturer)\s+)?(?:warranty|guarantee)\b/i,
    /\b(\d{1,2})\s+years?\s+comprehensive\b/i
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const amount = Number(match[1]);
    const months = /year/i.test(match[2] || match[0]) ? amount * 12 : amount;
    if (months >= 1 && months <= 120) return String(months);
  }
  return '';
}

function findModel(text) {
  const match = /\bmodel(?:\s+(?:no\.?|number|name))?\s*[:#-]?\s*([a-z0-9][a-z0-9/-]{1,49})/i.exec(text);
  return match?.[1]?.trim() || '';
}

function findSerial(text) {
  const match = /\b(?:serial(?:\s+(?:no\.?|number))?|s\s*\/\s*n)\s*[:#-]?\s*([a-z0-9][a-z0-9-]{3,31})/i.exec(text);
  return match?.[1]?.trim() || '';
}

export function parseBill(text = '', { localeHint = 'en-IN', today = new Date() } = {}) {
  const normalized = text.replace(/\r/g, ' ');
  return {
    purchaseDate: findPurchaseDate(normalized, localeHint, today),
    amount: findAmount(normalized),
    brand: findDictionaryValue(normalized, BRAND_DICTIONARY),
    productType: findDictionaryValue(normalized, PRODUCT_TYPE_DICTIONARY),
    warrantyMonths: findWarrantyMonths(normalized),
    modelName: findModel(normalized),
    serialNumber: findSerial(normalized)
  };
}
