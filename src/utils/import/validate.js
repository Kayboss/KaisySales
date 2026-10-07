import { getField, getRequiredFields } from './schema.js';
import { coerceField, formatMoneyText } from './coerce.js';

const isBlank = (value) => value === undefined || value === null || value === '';

const formatFieldValue = (field, value) => {
  if (field.type === 'moneyText') return formatMoneyText(value);
  return value;
};

const applyDerivations = (entity, values, issues) => {
  if (entity.key === 'sales') {
    if (isBlank(values.amount) && !isBlank(values.unitPrice)) {
      const quantity = isBlank(values.quantity) ? 1 : values.quantity;
      values.amount = values.unitPrice * quantity;
    }
  }

  if (entity.key === 'service_income') {
    if (isBlank(values.netAmount) && !isBlank(values.amount)) {
      const fee = isBlank(values.platformFee) ? 0 : values.platformFee;
      values.netAmount = values.amount - fee;
      if (fee > values.amount) {
        issues.push({
          severity: 'warning',
          field: 'platformFee',
          message: 'The platform fee is larger than the amount, so the net amount is negative.',
        });
      }
    }
  }

  if (entity.key === 'expenses' && isBlank(values.amount)) {
    issues.push({
      severity: 'warning',
      field: 'amount',
      message: 'No amount was given, so this will be recorded as zero.',
    });
  }
};

export const buildRecord = (entity, rawRow, mapping, options = {}) => {
  const { dayFirst } = options;
  const row = rawRow || [];
  const rowHasContent = row.some((cell) => String(cell == null ? '' : cell).trim() !== '');

  if (!rowHasContent) {
    return { record: {}, issues: [], hasErrors: false, isEmpty: true };
  }

  const values = {};
  const issues = [];

  for (const [columnIndex, fieldKey] of Object.entries(mapping)) {
    const field = getField(entity, fieldKey);
    if (!field) continue;

    const raw = rawRow[Number(columnIndex)];

    const result = coerceField(field, raw, { dayFirst });

    if (result.status === 'ok') {
      values[field.key] = result.value;
    } else if (result.status === 'invalid') {
      issues.push({ severity: 'error', field: field.key, message: result.reason });
    } else if (result.status === 'ambiguous') {
      issues.push({
        severity: 'error',
        field: field.key,
        kind: 'ambiguous',
        message: `The date "${String(raw).trim()}" could be ${result.reason}.`,
        candidates: result.candidates,
      });
    }
  }

  for (const field of getRequiredFields(entity)) {
    if (isBlank(values[field.key])) {
      const alreadyFailed = issues.some(
        (issue) => issue.field === field.key && issue.severity === 'error'
      );
      if (!alreadyFailed) {
        issues.push({
          severity: 'error',
          field: field.key,
          message: `${field.label} is needed for every row.`,
        });
      }
    }
  }

  applyDerivations(entity, values, issues);

  const record = {};
  for (const [key, value] of Object.entries(values)) {
    if (isBlank(value)) continue;
    const field = getField(entity, key);
    if (!field || !field.writable) continue;
    record[key] = formatFieldValue(field, value);
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error');

  return {
    record,
    issues,
    hasErrors,
    isEmpty: false,
  };
};

export const validateRows = (entity, rows, mapping, options = {}) => {
  const results = rows.map((row, index) => ({
    index,
    row,
    ...buildRecord(entity, row, mapping, options),
  }));

  const summary = {
    total: results.length,
    ready: results.filter((result) => !result.hasErrors && !result.isEmpty).length,
    withWarnings: results.filter(
      (result) => !result.hasErrors && result.issues.some((issue) => issue.severity === 'warning')
    ).length,
    blocked: results.filter((result) => result.hasErrors).length,
    empty: results.filter((result) => result.isEmpty).length,
  };

  return { results, summary };
};
