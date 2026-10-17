/**
 * The deterministic fast path for "talk to record".
 *
 * Most sentences people actually say follow a handful of shapes — "paid 800
 * for fuel", "received 5,000 from Kwame", "sold 12 bags of cement for 96,000".
 * Those do not need a model, they need a pattern. This module recognises them
 * locally: the card arrives instantly, with no network, no cost per parse and
 * nothing to rot when a provider retires a model. The Edge Function is spent
 * only on the sentences this module declines.
 *
 * The contract is one line: a confident shape, or null. An amount and a thing
 * with no direction — "39.00 for sticker printing" — is not knowable from the
 * words alone, so it goes to the model rather than being guessed.
 *
 * Pure and import-light on purpose: it unit-tests in plain Node.
 */

// A number with optional thousands separators and decimals. The first one in
// the region being read is the amount.
const AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/;

// Money out. "Paid me" is the one form that reads the other way:
// "Ama paid me 500" is money in.
const OUT_RE = /\b(paid|spent|spend|spending|bought|buying|purchased|lost)\b/i;
const IN_RE = /\b(received|got|collected|earned|invoiced)\b/i;
const PAID_ME_RE = /\bpaid\s+me\b/i;
const SOLD_RE = /\bsold\b/i;

const DATE_HINTS = [
  { re: /\s*\btonight\b/i, days: 0 },
  { re: /\s*\btoday\b/i, days: 0 },
  { re: /\s*\bthis\s+(morning|afternoon|evening)\b/i, days: 0 },
  { re: /\s*\blast\s+night\b/i, days: -1 },
  { re: /\s*\byesterday\b/i, days: -1 },
];

const shiftIso = (iso, days) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
};

/**
 * Peels trailing (and leading) date words off a sentence: "…today" means today,
 * "…last night" means yesterday. Returns the words left and how many days to
 * shift, or null when the sentence named no day at all.
 */
const peelDate = (raw) => {
  let text = String(raw || '').trim();
  let days = null;
  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false;
    for (const hint of DATE_HINTS) {
      const stripped = text
        .replace(new RegExp(`(?:${hint.re.source})\\s*$`, 'i'), '')
        .replace(new RegExp(`^\\s*(?:${hint.re.source})`, 'i'), '')
        .trim();
      if (stripped !== text) {
        text = stripped;
        days = hint.days;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { text, days };
};

const cleanText = (raw) =>
  String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,!?;:'"()-]+|[\s.,!?;:'"()-]+$/g, '')
    .trim()
    .slice(0, 100);

const numberFrom = (match) => parseFloat(String(match[1]).replace(/,/g, ''));

const categoryFor = (categories, guess) => {
  const wanted = cleanText(guess).toLowerCase();
  if (!wanted || !Array.isArray(categories)) return '';
  const hit = categories.find((name) => String(name || '').trim().toLowerCase() === wanted);
  return hit ? String(hit).trim() : '';
};

/**
 * "sold 12 bags of cement for 96,000" | "sold cement to Ada for 500" |
 * "sold 2 shirts at 50 each". Returns the sale fields, or null when the money
 * side is missing — "sold cement" is not a record without a price.
 */
const parseSale = (text) => {
  const lead = /^sold\s+/i.exec(text);
  if (!lead) return null;
  let rest = text.slice(lead[0].length).trim();

  let quantity = 1;
  const qty = /^(\d{1,4})\s+/.exec(rest);
  if (qty) {
    quantity = parseInt(qty[1], 10);
    rest = rest.slice(qty[0].length).trim();
  }

  const split = /\s+(for|at|to)\s+/i.exec(rest);
  if (!split) return null;
  const item = cleanText(peelDate(rest.slice(0, split.index)).text);
  if (!item) return null;

  let after = rest.slice(split.index + split[0].length).trim();
  const connector = split[1].toLowerCase();

  let amount = 0;
  let unitPrice = 0;
  let client = '';

  if (connector === 'to') {
    // "to Ada for 500" — the name runs up to the price, if there is one.
    let namePart = after;
    const forSplit = /\s+for\s+/i.exec(after);
    if (forSplit) {
      namePart = after.slice(0, forSplit.index);
      after = after.slice(forSplit.index + forSplit[0].length).trim();
    } else {
      after = '';
    }
    client = cleanText(peelDate(namePart).text);
    const match = AMOUNT_RE.exec(after);
    if (match) amount = numberFrom(match);
  } else {
    const match = AMOUNT_RE.exec(after);
    if (match) {
      amount = numberFrom(match);
      if (connector === 'at') unitPrice = amount;
    }
  }

  if (!(amount > 0) && !(unitPrice > 0)) return null;

  const fields = { item, quantity };
  if (unitPrice > 0) fields.unitPrice = unitPrice;
  else fields.amount = String(amount);
  if (client) fields.client_name = client;
  return fields;
};

/**
 * "paid 800 for fuel" | "I spend 80.00 on gas today" | "spent 20 on data last
 * night". The direction word and the price must both be there; anything else is
 * the model's job.
 */
const parseExpense = (text, categories) => {
  const verb = OUT_RE.exec(text);
  if (!verb) return null;
  const afterVerb = text.slice(verb.index + verb[0].length).trim();
  const amountMatch = AMOUNT_RE.exec(afterVerb);
  if (!amountMatch) return null;
  const amount = numberFrom(amountMatch);
  const rest = afterVerb.slice(amountMatch.index + amountMatch[0].length).trim();
  const desc = /^(?:for|on)\s+(.+)$/i.exec(rest);
  if (!desc) return null;
  const title = cleanText(peelDate(desc[1]).text);
  if (!title) return null;
  const fields = { title, amount: String(amount) };
  const category = categoryFor(categories, title);
  if (category) fields.category = category;
  return fields;
};

/**
 * "received 5,000 from Kwame" | "Ama paid me 500" | "collected 300 from the
 * shop yesterday".
 */
const parseIncome = (text) => {
  const paidMe = PAID_ME_RE.exec(text);
  let client = '';

  if (paidMe) {
    client = cleanText(text.slice(0, paidMe.index));
  } else {
    const from = /\bfrom\s+([\p{L}\p{N}&'.-]+(?:\s+[\p{L}\p{N}&'.-]+){0,3})/iu.exec(text);
    if (from) client = cleanText(peelDate(from[1]).text);
  }
  if (client.length > 40) client = client.slice(0, 40).trim();

  const region = paidMe ? text.slice(paidMe.index + paidMe[0].length) : text;
  const amountMatch = AMOUNT_RE.exec(region);
  if (!amountMatch) return null;
  const amount = numberFrom(amountMatch);

  const fields = { amount: String(amount) };
  if (client) fields.client_name = client;
  return fields;
};

/**
 * @param {string} sentence one thing the user said
 * @param {{ mode?: 'retail'|'services', today?: string, categories?: string[] }} options
 * @returns {{ kind: 'record', recordType: string, confidence: 'high', fields: object } | null}
 */
export const fastParse = (sentence, options = {}) => {
  const mode = options.mode === 'services' ? 'services' : 'retail';
  const today = options.today || new Date().toISOString().split('T')[0];

  const text = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  // More than one sentence and the phrasing gets clever — the model's job.
  if (text.split(/[.!?](?=\s|$)/).filter((part) => part.trim()).length > 1) return null;
  if (!AMOUNT_RE.test(text)) return null;

  const { days } = peelDate(text);
  const date = shiftIso(today, days === null ? 0 : days);

  const finish = (recordType, fields) => ({
    kind: 'record',
    recordType,
    confidence: 'high',
    fields: { ...fields, date },
  });

  if (mode === 'retail' && SOLD_RE.test(text)) {
    const sale = parseSale(text);
    return sale ? finish('sale', sale) : null;
  }
  if (mode === 'retail' && !SOLD_RE.test(text) && (IN_RE.test(text) || PAID_ME_RE.test(text))) {
    // Money in with no item named is a sale we cannot name — only the model can
    // decide what was sold, and a guess would move the wrong stock.
    return null;
  }

  if (PAID_ME_RE.test(text) && !/\b(paid|spent|spend|bought|purchased)\s+\d/i.test(text)) {
    if (mode !== 'services') return null;
    const income = parseIncome(text);
    return income ? finish('service_income', income) : null;
  }

  if (OUT_RE.test(text)) {
    const expense = parseExpense(text, options.categories);
    return expense ? finish('expense', expense) : null;
  }

  if (IN_RE.test(text)) {
    if (mode !== 'services') return null;
    const income = parseIncome(text);
    return income ? finish('service_income', income) : null;
  }

  return null;
};
