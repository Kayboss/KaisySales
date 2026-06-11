const CURRENCY_MAP = {
  'en-GH': { code: 'GHS', symbol: 'GH₵', locale: 'en-GH' },
  'en-NG': { code: 'NGN', symbol: '₦', locale: 'en-NG' },
  'en-KE': { code: 'KES', symbol: 'KSh', locale: 'en-KE' },
  'en-ZA': { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
  'en-TZ': { code: 'TZS', symbol: 'TSh', locale: 'en-TZ' },
  'en-UG': { code: 'UGX', symbol: 'USh', locale: 'en-UG' },
  'en-US': { code: 'USD', symbol: '$', locale: 'en-US' },
  'en-GB': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'en-CM': { code: 'XAF', symbol: 'FCFA', locale: 'en-CM' },
  'fr-CM': { code: 'XAF', symbol: 'FCFA', locale: 'fr-CM' },
  'en-SL': { code: 'SLL', symbol: 'Le', locale: 'en-SL' },
  'en-LR': { code: 'LRD', symbol: '$', locale: 'en-LR' },
  'en-GM': { code: 'GMD', symbol: 'D', locale: 'en-GM' },
};

const FALLBACK = { code: 'GHS', symbol: 'GH₵', locale: 'en-GH' };

export function detectCurrency() {
  try {
    const locale = navigator.language || 'en-GH';
    const match = CURRENCY_MAP[locale];
    if (match) return match;
    const lang = locale.split('-')[0];
    for (const key in CURRENCY_MAP) {
      if (key.startsWith(lang + '-')) return CURRENCY_MAP[key];
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function formatCurrency(amount, currencyCode) {
  const currency = currencyCode
    ? Object.values(CURRENCY_MAP).find(c => c.code === currencyCode) || FALLBACK
    : FALLBACK;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) || 0 : amount || 0;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency.symbol}${num.toFixed(2)}`;
  }
}

export function formatCurrencyShort(amount, currencyCode) {
  const currency = currencyCode
    ? Object.values(CURRENCY_MAP).find(c => c.code === currencyCode) || FALLBACK
    : FALLBACK;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) || 0 : amount || 0;
  return `${currency.symbol}${num.toLocaleString()}`;
}

export function getCurrencySymbol(currencyCode) {
  const currency = currencyCode
    ? Object.values(CURRENCY_MAP).find(c => c.code === currencyCode) || FALLBACK
    : FALLBACK;
  return currency.symbol;
}

export const CURRENCY_OPTIONS = Object.values(CURRENCY_MAP).filter(
  (c, i, arr) => arr.findIndex(x => x.code === c.code) === i
).map(c => ({ code: c.code, symbol: c.symbol }));
