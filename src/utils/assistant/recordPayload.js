import { sanitizeInput, sanitizeNumber } from '../sanitize.js';
import { formatMoneyText } from '../import/coerce.js';
import { formatCurrency } from '../currency.js';

/**
 * Turns the fields the model parsed out of one sentence into the exact payload
 * the matching screen would have written, so an assistant-recorded expense, sale
 * or income is indistinguishable from a hand-typed one.
 *
 * Pure and import-light on purpose: the mapping is the part most likely to drift
 * from ExpenseTracking / DailySales / IncomeTracking, so it is unit tested in
 * plain Node (scripts/assistant-record.test.mjs).
 */

export const RECORD_TYPE_LABELS = {
  expense: 'Expense',
  sale: 'Sale',
  service_income: 'Income',
};

// section a saved record lands in — used for the "Saved to X" confirmation
export const RECORD_TYPE_SECTIONS = {
  expense: 'Expenses',
  sale: 'Sales History',
  service_income: 'Income Tracking',
};

export const allowedRecordTypes = (mode) =>
  mode === 'services' ? ['expense', 'service_income'] : ['expense', 'sale'];

// Must match SUBCATEGORIES in ServiceExpenses.jsx. The parser picks one of these
// and anything else falls back to 'general', the same default that screen uses.
export const EXPENSE_SUBCATEGORIES = ['general', 'saas', 'subcontractor', 'hardware', 'platform_fee'];

const normalizePaymentMethod = (raw) => {
  const text = String(raw || '').toLowerCase();
  if (text.includes('mobile') || text.includes('momo') || text.includes('m-pesa')) {
    return 'Mobile Money';
  }
  if (text.includes('card') || text.includes('visa') || text.includes('master')) return 'Card';
  return 'Cash';
};

const isoDate = (value, fallback) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : fallback;
};

const localTime = (date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(date);

const row = (label, value) => (value === '' || value === null || value === undefined ? null : { label, value });

/**
 * @param {string} recordType 'expense' | 'sale' | 'service_income'
 * @param {object} fields model output
 * @param {{ mode?: 'retail'|'services', currency?: string, today?: string, now?: Date }} options
 */
export const buildRecordPayload = (recordType, fields = {}, options = {}) => {
  const mode = options.mode === 'services' ? 'services' : 'retail';
  const currency = options.currency || 'GHS';
  const now = options.now instanceof Date ? options.now : new Date();
  const today = options.today || now.toISOString().split('T')[0];
  const money = (value) => formatCurrency(value, currency);

  if (!allowedRecordTypes(mode).includes(recordType)) {
    return { ok: false, error: `That record type does not belong to your business type.` };
  }

  if (recordType === 'expense') {
    const title = sanitizeInput(String(fields.title || '').trim(), 100);
    if (!title) return { ok: false, error: 'What was the money spent on?' };

    const quantity = Math.max(1, Math.round(sanitizeNumber(fields.quantity)) || 1);
    let unitPrice = sanitizeNumber(fields.unitPrice);
    let total = sanitizeNumber(fields.amount);

    if (unitPrice > 0) {
      total = quantity * unitPrice;
    } else if (total > 0) {
      unitPrice = total / quantity;
    } else {
      return { ok: false, error: 'How much did you spend?' };
    }

    const category = sanitizeInput(String(fields.category || ''), 50);
    const date = isoDate(fields.date, today);

    // Retail's ExpenseTracking and services' ServiceExpenses are different rows in
    // the same table, so "expense" is not one payload. ServiceExpenses.jsx:284 has
    // no quantity or unit price and carries client, vendor, renewal and the
    // asset/fee columns instead. Writing the retail shape into a services account
    // leaves those columns blank on the owner's own screen, so each mode gets the
    // shape its screen would have written.
    if (mode === 'services') {
      const fee = Math.max(0, sanitizeNumber(fields.transaction_fee));
      const stated = String(fields.subcategory || '');
      const subcategory = EXPENSE_SUBCATEGORIES.includes(stated) ? stated : 'general';
      const isAsset = fields.is_asset === true;
      const lifetime = parseInt(fields.asset_lifetime_years, 10);
      const clientName = sanitizeInput(String(fields.client_name || '').trim(), 100);
      const vendor = sanitizeInput(String(fields.vendor || '').trim(), 100);
      const renewalDate = isoDate(fields.renewal_date, null);
      const billed = parseFloat((total + fee).toFixed(2));
      const payload = {
        title,
        amount: formatMoneyText(billed),
        category,
        date,
        subcategory,
        vendor,
        renewal_date: renewalDate,
        is_asset: isAsset,
        asset_lifetime_years: isAsset && lifetime > 0 ? lifetime : null,
        transaction_fee: fee,
        client_name: clientName,
      };
      const summary = [
        row('Amount', money(billed)),
        row('What', title),
        row('Client', clientName),
        row('Category', category),
        row('Vendor', vendor),
        row('Date', date),
        row('Renewal', renewalDate),
        row('Fee', fee > 0 ? money(fee) : ''),
        row('Asset', isAsset ? 'Yes' : ''),
      ].filter(Boolean);
      return { ok: true, recordType, payload, summary };
    }

    const payload = {
      title,
      category,
      quantity,
      unitPrice,
      date,
      amount: formatMoneyText(total),
      trend: 'up',
    };
    const summary = [
      row('Amount', money(total)),
      row('What', title),
      row('Category', category),
      row('Quantity', quantity > 1 ? `${quantity}` : ''),
      row('Date', date),
    ].filter(Boolean);
    return { ok: true, recordType, payload, summary };
  }

  if (recordType === 'sale') {
    const item = sanitizeInput(String(fields.item || '').trim(), 100);
    if (!item) return { ok: false, error: 'What did you sell?' };

    const quantity = Math.max(1, Math.round(sanitizeNumber(fields.quantity)) || 1);
    let unitPrice = sanitizeNumber(fields.unitPrice);
    const stated = sanitizeNumber(fields.amount);
    if (!(unitPrice > 0) && stated > 0) unitPrice = stated / quantity;
    if (!(unitPrice > 0)) return { ok: false, error: 'How much did you sell it for?' };

    const total = quantity * unitPrice;
    const category = sanitizeInput(String(fields.category || ''), 50);
    const date = isoDate(fields.date, today);
    const paymentMethod = normalizePaymentMethod(fields.paymentMethod);
    const payload = {
      item,
      category,
      quantity,
      unitPrice,
      paymentMethod,
      date,
      time: localTime(now),
      amount: formatMoneyText(total),
    };
    const summary = [
      row('Amount', money(total)),
      row('Item', item),
      row('Quantity', `${quantity}`),
      row('Unit price', money(unitPrice)),
      row('Payment', paymentMethod),
      row('Category', category),
      row('Date', date),
    ].filter(Boolean);
    return {
      ok: true,
      recordType,
      payload,
      summary,
    };
  }

  // service_income
  const amount = sanitizeNumber(fields.amount);
  if (!(amount > 0)) return { ok: false, error: 'How much did you receive?' };

  const fee = Math.max(0, sanitizeNumber(fields.platform_fee));
  const clientName = sanitizeInput(String(fields.client_name || '').trim(), 100);
  const category = sanitizeInput(String(fields.category || ''), 50);
  const notes = sanitizeInput(String(fields.notes || ''), 500);
  const paymentDate = isoDate(fields.date, today);
  const payload = {
    client_name: clientName,
    amount,
    platform_fee: fee,
    net_amount: parseFloat((amount - fee).toFixed(2)),
    platform_tag: 'direct',
    milestone_label: '',
    payment_date: paymentDate,
    notes,
    category,
  };
  const summary = [
    row('Amount', money(amount)),
    row('Client', clientName),
    row('Fee', fee > 0 ? money(fee) : ''),
    row('Net', fee > 0 ? money(amount - fee) : ''),
    row('Category', category),
    row('Date', paymentDate),
    row('Notes', notes),
  ].filter(Boolean);
  return { ok: true, recordType, payload, summary };
};
