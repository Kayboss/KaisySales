const IGNORED_HEADERS = [
  'id',
  'userid',
  'uuid',
  'createdat',
  'updatedat',
  'rownumber',
  'rownr',
  'index',
  'slno',
  'sno',
  'serial',
  'serialno',
];

export const normalizeHeader = (value) =>
  String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const distance = (a, b) => {
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
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - distance(a, b) / longest;
};

const buildIndex = (entity) => {
  const byNormalized = new Map();
  const fieldKeys = [];

  for (const field of entity.fields) {
    const normalizedKey = normalizeHeader(field.key);
    fieldKeys.push(normalizedKey);
    if (!byNormalized.has(normalizedKey)) byNormalized.set(normalizedKey, field.key);
    for (const alias of field.aliases) {
      const normalizedAlias = normalizeHeader(alias);
      if (!byNormalized.has(normalizedAlias)) byNormalized.set(normalizedAlias, field.key);
    }
  }

  return { byNormalized, fieldKeys };
};

export const matchColumn = (header, entity, index = buildIndex(entity)) => {
  const normalized = normalizeHeader(header);

  if (normalized === '') {
    return { field: null, confidence: 'empty', candidates: [] };
  }

  if (IGNORED_HEADERS.includes(normalized)) {
    return { field: null, confidence: 'ignored', candidates: [] };
  }

  const exact = index.byNormalized.get(normalized);
  if (exact) {
    return { field: exact, confidence: 'exact', candidates: [exact] };
  }

  let best = { field: null, score: 0 };
  const candidates = [];

  for (const [alias, fieldKey] of index.byNormalized) {
    const score = similarity(normalized, alias);
    if (score >= 0.8) {
      if (!candidates.includes(fieldKey)) candidates.push(fieldKey);
      if (score > best.score) best = { field: fieldKey, score };
    }
  }

  if (best.field) {
    return { field: best.field, confidence: 'fuzzy', candidates };
  }

  return { field: null, confidence: 'none', candidates };
};

export const matchHeaders = (headers, entity) => {
  const index = buildIndex(entity);
  const taken = new Set();

  const columns = headers.map((header, i) => {
    const match = matchColumn(header, entity, index);
    let field = match.field;

    if (field && taken.has(field)) {
      return {
        index: i,
        header,
        field: null,
        confidence: 'duplicate',
        candidates: [field],
        matchedField: field,
      };
    }

    if (field) taken.add(field);

    return {
      index: i,
      header,
      field,
      confidence: match.confidence,
      candidates: match.candidates,
    };
  });

  const mapped = columns.filter((column) => column.field).map((column) => column.field);
  const unmapped = entity.fields
    .filter((field) => !mapped.includes(field.key))
    .map((field) => field.key);

  const needsReview = columns.some(
    (column) => column.confidence === 'fuzzy' || column.confidence === 'duplicate'
  );

  return { columns, unmapped, needsReview };
};

export const buildAutoMapping = (headers, entity) => {
  const { columns } = matchHeaders(headers, entity);
  const mapping = {};
  for (const column of columns) {
    if (column.field) mapping[column.index] = column.field;
  }
  return mapping;
};
