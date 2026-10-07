const CURRENCY_PREFIX = String.raw`(?:\s*(?:GHS?|NGN|USD|GBP|EUR|KES|ZAR|UGX|cedis?|naira)?\s*[\p{Sc}]?\s*)`;
const NUMBER_PATTERN = String.raw`-?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)`;
const NUMBER_RE = new RegExp(String.raw`^${CURRENCY_PREFIX}(${NUMBER_PATTERN})$`, 'iu');

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const TRUE_WORDS = ['true', 'yes', 'y', '1', 'on', 'active', 'enabled', 'x'];
const FALSE_WORDS = ['false', 'no', 'n', '0', 'off', 'inactive', 'disabled', ''];

const blank = () => ({ status: 'blank', value: null });
const invalid = (reason) => ({ status: 'invalid', value: null, reason });
const ok = (value) => ({ status: 'ok', value });

const toNumberString = (raw) => {
  const match = String(raw).match(NUMBER_RE);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseMoney = (raw) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return blank();
  const parsed = toNumberString(raw);
  if (parsed === null) return invalid(`"${String(raw).trim()}" is not a number`);
  return ok(parsed);
};

export const parseNumber = (raw) => parseMoney(raw);

export const parseInteger = (raw) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return blank();
  const parsed = toNumberString(raw);
  if (parsed === null) return invalid(`"${String(raw).trim()}" is not a whole number`);
  if (!Number.isInteger(parsed)) {
    return invalid(`"${String(raw).trim()}" is not a whole number`);
  }
  return ok(parsed);
};

export const parseBoolean = (raw) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return blank();
  const normalized = String(raw).trim().toLowerCase();
  if (TRUE_WORDS.includes(normalized)) return ok(true);
  if (FALSE_WORDS.includes(normalized)) return ok(false);
  return invalid(`"${String(raw).trim()}" is not yes or no`);
};

export const parseEnum = (raw, field) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return blank();

  const normalized = String(raw).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (field.values.includes(normalized)) return ok(normalized);

  const aliases = field.valueAliases || {};
  for (const [canonical, options] of Object.entries(aliases)) {
    if (options.includes(normalized)) return ok(canonical);
  }

  return invalid(`"${String(raw).trim()}" is not one of ${field.values.join(', ')}`);
};

const daysInMonth = (year, month) => {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};

const makeDate = (year, month, day) => {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return invalid('year out of range');
  if (!Number.isInteger(month) || month < 1 || month > 12) return invalid('month must be 1 to 12');
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    return invalid('that day does not exist in that month');
  }
  const pad = (n) => String(n).padStart(2, '0');
  return ok(`${year}-${pad(month)}-${pad(day)}`);
};

const expandYear = (value) => {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
};

export const parseDate = (raw, options = {}) => {
  const { dayFirst } = options;
  if (raw === null || raw === undefined || String(raw).trim() === '') return blank();

  const text = String(raw).trim();
  const lower = text.toLowerCase();

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (match) return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    if (first > 12 && second <= 12) return makeDate(year, second, first);
    if (second > 12 && first <= 12) return makeDate(year, first, second);
    if (first > 12 && second > 12) return invalid('neither part of the date is a month');
    if (dayFirst === true) return makeDate(year, second, first);
    if (dayFirst === false) return makeDate(year, first, second);
    return {
      status: 'ambiguous',
      value: null,
      reason: 'the day and month could be read either way',
      candidates: [makeDate(year, second, first), makeDate(year, first, second)],
    };
  }

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = expandYear(match[3]);
    if (first > 12 && second <= 12) return makeDate(year, second, first);
    if (second > 12 && first <= 12) return makeDate(year, first, second);
    if (first > 12 && second > 12) return invalid('neither part of the date is a month');
    if (dayFirst === true) return makeDate(year, second, first);
    if (dayFirst === false) return makeDate(year, first, second);
    return {
      status: 'ambiguous',
      value: null,
      reason: 'the day and month could be read either way',
      candidates: [makeDate(year, second, first), makeDate(year, first, second)],
    };
  }

  match = text.match(/^(\d{1,2})[\s-,]+([a-z]+)[\s-,]+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) return invalid(`"${match[2]}" is not a month`);
    return makeDate(Number(match[3]), month, Number(match[1]));
  }

  match = text.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (!month) return invalid(`"${match[1]}" is not a month`);
    return makeDate(Number(match[3]), month, Number(match[2]));
  }

  match = text.match(/^(\d{1,2})[-\s]([a-z]+)[-\s](\d{2})$/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (!month) return invalid(`"${match[2]}" is not a month`);
    return makeDate(expandYear(match[3]), month, Number(match[1]));
  }

  if (/^\d{1,2}:\d{2}/.test(text) || lower === 'today' || lower === 'yesterday') {
    return invalid(`"${text}" has no day, month and year in it`);
  }

  return invalid(`"${text}" is not a date`);
};

export const suggestDayFirst = (samples) => {
  let dayFirstVotes = 0;
  let monthFirstVotes = 0;

  for (const sample of samples) {
    const match = String(sample).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/);
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) dayFirstVotes++;
    else if (second > 12 && first <= 12) monthFirstVotes++;
  }

  if (dayFirstVotes > 0 && monthFirstVotes === 0) return true;
  if (monthFirstVotes > 0 && dayFirstVotes === 0) return false;
  return null;
};

export const formatMoneyText = (value) => `GHS ${Number(value).toFixed(2)}`;

const COERCERS = {
  text: (raw) => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return blank();
    return ok(String(raw).trim());
  },
  moneyText: (raw) => parseMoney(raw),
  number: (raw) => parseNumber(raw),
  decimal: (raw) => parseNumber(raw),
  integer: (raw) => parseInteger(raw),
  boolean: (raw) => parseBoolean(raw),
  date: (raw, field, options) => parseDate(raw, options),
  enum: (raw, field) => parseEnum(raw, field),
};

export const coerceField = (field, raw, options = {}) => {
  const coercer = COERCERS[field.type];
  if (!coercer) return invalid(`no converter for "${field.type}"`);
  return coercer(raw, field, options);
};
