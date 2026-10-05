import { parseAmount } from './currency.js';
import { serviceRowReceived } from './serviceFinance.js';

/**
 * Outstanding invoice balances — one implementation, shared by the Reports page
 * and the standalone Outstanding page, so the two can never disagree about what
 * a customer still owes.
 *
 * Payments are matched against ALL income, never a date-filtered subset. An
 * invoice raised last year and settled today is genuinely settled; matching it
 * only against income inside a narrow window would resurface it as overdue.
 */

/**
 * A payment is tied to an invoice by its notes text. Kept identical to the
 * matcher already used by the Reports page.
 */
export const paymentsForInvoice = (income, invoice) =>
  income.filter(i =>
    (i.platformTag === 'invoice' || i.platformTag === 'payment') &&
    new RegExp('invoice #' + String(invoice.id) + '(?!\\d)', 'i').test(String(i.notes || ''))
  );

/**
 * Per-invoice rows with a non-zero balance, most recently dated first.
 *
 * `paid` is capped at the billed amount so a double-entered payment cannot
 * manufacture a negative balance.
 */
/** Status is compared case-insensitively: the column default is 'Pending' but
 *  the app writes lowercase 'paid', so legacy rows are title-case. An exact
 *  match would miss a genuinely settled legacy invoice and re-report it as
 *  money still owed. */
export const isInvoicePaid = (invoice = {}) => String(invoice.status || '').toLowerCase() === 'paid';

export const buildOutstandingRows = (invoices = [], income = []) => {
  const paidAmountOf = (invoice) => {
    if (isInvoicePaid(invoice)) return parseAmount(invoice.amount);
    const paid = paymentsForInvoice(income, invoice).reduce((s, i) => s + serviceRowReceived(i), 0);
    return Math.min(paid, parseAmount(invoice.amount));
  };

  return invoices
    .map(invoice => {
      const amount = parseAmount(invoice.amount);
      const paid = paidAmountOf(invoice);
      const items = Array.isArray(invoice.items) ? invoice.items.filter(i => !i.type) : [];
      return {
        customer: invoice.customer || 'Unknown',
        invoiceId: invoice.id,
        service: items[0]?.name || `Invoice #${invoice.id}`,
        date: invoice.date || '',
        amount,
        paid,
        balance: Math.max(0, amount - paid),
      };
    })
    .filter(row => row.balance > 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

/** Roll the open items up per customer, largest balance first. */
export const summariseByCustomer = (rows = []) => {
  const grouped = {};
  rows.forEach(row => {
    if (!grouped[row.customer]) grouped[row.customer] = [];
    grouped[row.customer].push(row);
  });
  return Object.entries(grouped)
    .map(([name, items]) => ({
      name,
      count: items.length,
      total: items.reduce((s, r) => s + r.balance, 0),
      oldest: items.map(r => r.date).filter(Boolean).sort()[0] || '',
    }))
    .sort((a, b) => b.total - a.total);
};

/** An item is overdue once its date is in the past. Undated items are not. */
export const isOverdue = (row, todayIso) => Boolean(row.date) && row.date < todayIso;

/** Count of overdue open items. */
export const countOverdue = (rows = [], todayIso) => rows.filter(row => isOverdue(row, todayIso)).length;