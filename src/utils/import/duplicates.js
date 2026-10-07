/**
 * Near-duplicate detection and value merge rules for imports.
 *
 * Deliberately import-free (like every other util in utils/import) so the
 * module can be unit tested in plain Node without a browser or a bundler.
 *
 * A record is an "exact" duplicate of an existing row when every identity
 * field that appears on BOTH sides is equal. A near duplicate is one where the
 * shared identity fields read close enough to warrant a merge decision.
 */

const IDENTITY_FIELDS = {
  inventory: ['name'],
  sales: ['item', 'amount', 'date'],
  expenses: ['title', 'amount', 'date'],
  service_income: ['clientName', 'amount', 'paymentDate'],
  recurring_income: ['clientName', 'amount', 'frequency'],
  customers: ['name', 'email'],
};

export const NEAR_THRESHOLD = 0.88;

const MONEY_TYPES = ['moneyText', 'decimal', 'number', 'integer'];

export const normalizeValue = (value) => String(value == null ? '' : value).toLowerCase().trim();

export const canonical = (value) => normalizeValue(value).replace(/[^a-z0-9]+/g, '');

const fieldCanonical = (value, type) => {
  if (!MONEY_TYPES.includes(type)) return canonical(value);
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? String(number) : canonical(value);
};

const editDistance = (a, b) => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
};

export const similarity = (a, b) => {
  const canonicalA = canonical(a);
  const canonicalB = canonical(b);
  const longest = Math.max(canonicalA.length, canonicalB.length);
  if (longest === 0) return 1;
  return 1 - editDistance(canonicalA, canonicalB) / longest;
};

const present = (value) => canonical(value) !== '';

const fieldSim = (left, right, type) => {
  const a = fieldCanonical(left, type);
  const b = fieldCanonical(right, type);
  if (a === b) return 1;
  if (MONEY_TYPES.includes(type)) return 0;
  return similarity(a, b);
};

const compareRows = (entity, left, right) => {
  const fields = IDENTITY_FIELDS[entity.key] || [];
  const common = fields.filter((field) => present(left[field]) && present(right[field]));

  if (common.length === 0) {
    return null;
  }

  let total = 0;
  let exact = true;
  for (const field of common) {
    const type = entity.fields.find((candidate) => candidate.key === field)?.type || 'text';
    const score = fieldSim(left[field], right[field], type);
    total += score;
    if (score !== 1) exact = false;
  }

  return { exact, score: total / common.length };
};

/**
 * For each incoming record, locate its best existing row — an exact duplicate
 * first, otherwise the closest near match above the threshold.
 *
 * @param {{ key: string }} entity
 * @param {object[]} incoming validated camelCase records about to be imported
 * @param {object[]} existing rows already stored for this user
 * @returns {{ exact: Array<{record, existing, score}>, near: Array<{record, existing, score}>, unique: number }}
 */
export const findDuplicates = (entity, incoming, existing) => {
  const rows = Array.isArray(existing) ? existing : [];
  const exact = [];
  const near = [];
  const used = new Set();

  for (const record of incoming) {
    let bestExact = null;
    let bestNear = null;

    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      const compared = compareRows(entity, record, rows[i]);
      if (!compared) continue;

      if (compared.exact) {
        bestExact = { index: i, row: rows[i], score: compared.score };
        break;
      }
      if (compared.score >= NEAR_THRESHOLD && (!bestNear || compared.score > bestNear.score)) {
        bestNear = { index: i, row: rows[i], score: compared.score };
      }
    }

    if (bestExact) {
      used.add(bestExact.index);
      exact.push({ record, existing: bestExact.row, score: bestExact.score });
    } else if (bestNear) {
      used.add(bestNear.index);
      near.push({ record, existing: bestNear.row, score: bestNear.score });
    }
  }

  return { exact, near, unique: incoming.length - exact.length - near.length };
};

const isBlank = (value) => value === undefined || value === null || value === '';

/**
 * Builds the record that should actually be written for an existing row.
 *
 * mode 'merge'  — only fills gaps; values already present on the existing row
 *                 are never overwritten.
 * mode 'replace' — every value present on the file record wins; blanks never
 *                 wipe data the existing row already has.
 *
 * Either way a blank cell in the file can never erase stored data.
 *
 * @param {{ fields: Array<{key: string, writable?: boolean}> }} entity
 * @param {object} existing the stored row (with id)
 * @param {object} incoming the validated file record
 * @param {'merge'|'replace'} mode
 * @returns {object} the merged record, unchanged where the file is blank
 */
export const applyImportValues = (entity, existing, incoming, mode = 'merge') => {
  const result = { ...existing };

  for (const field of entity.fields) {
    if (field.key === 'id' || field.key === 'user_id' || field.key === 'uid') continue;
    if (field.writable === false) continue;

    const value = incoming[field.key];
    if (isBlank(value)) continue;
    if (mode === 'merge' && !isBlank(existing[field.key])) continue;

    result[field.key] = value;
  }

  return result;
};

export { IDENTITY_FIELDS };