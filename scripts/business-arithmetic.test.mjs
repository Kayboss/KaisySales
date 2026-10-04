import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/utils/currency.js';
import {
  serviceProfit, serviceGross, serviceFees, serviceReceived, serviceRowReceived,
} from '../src/utils/serviceFinance.js';
import { sanitizeNumber } from '../src/utils/sanitize.js';
import {
  DEFAULT_MIN_STOCK,
  applyStockDelta,
  countItemsMissingCost,
  countItemsWithCost,
  countUnitsInStock,
  grossMarginPercent,
  resolveMinStock,
  resolveStock,
  resolveStockStatus,
  stockRetailValue,
  stockValueAtCost,
} from '../src/utils/inventory.js';

test('parseAmount keeps the sign of a credit or return', () => {
  assert.equal(parseAmount('-50.00'), -50);
  assert.equal(parseAmount('GHS -50.00'), -50);
  assert.equal(parseAmount('-120'), -120);
});

test('parseAmount reads every stored amount prefix', () => {
  assert.equal(parseAmount('GHS 120.50'), 120.5);
  assert.equal(parseAmount('GH₵ 120.50'), 120.5, 'rows written before the currency switch');
  assert.equal(parseAmount('GHS 1,200.00'), 1200, 'thousands separators');
  assert.equal(parseAmount(75), 75);
  assert.equal(parseAmount(null), 0);
});

test('sanitizeNumber keeps a leading minus instead of flipping the value', () => {
  assert.equal(sanitizeNumber('-5'), -5);
  assert.equal(sanitizeNumber('  -5.50 '), -5.5);
  assert.equal(sanitizeNumber('GHS -12.00'), -12);
  assert.equal(sanitizeNumber(7), 7);
  assert.equal(sanitizeNumber('12'), 12);
  assert.ok(!Object.is(sanitizeNumber('-0'), -0), 'must not produce negative zero');
  assert.equal(sanitizeNumber('abc'), 0);
});

test('sanitizeNumber keeps only the first decimal point', () => {
  assert.equal(sanitizeNumber('1.2.3'), 1.23);
});

test('resolveMinStock honours a per-item threshold', () => {
  assert.equal(resolveMinStock({ minStock: 12 }), 12);
  assert.equal(resolveMinStock({ min_stock: 3 }), 3);
  assert.equal(resolveMinStock({ minStock: '8' }), 8);
  assert.equal(resolveMinStock({ minStock: 0 }), 0);
});

test('resolveMinStock falls back rather than reporting zero', () => {
  assert.equal(resolveMinStock({}), DEFAULT_MIN_STOCK);
  assert.equal(resolveMinStock({ minStock: null }), DEFAULT_MIN_STOCK);
  assert.equal(resolveMinStock({ minStock: '' }), DEFAULT_MIN_STOCK);
  assert.equal(resolveMinStock({ minStock: 'oops' }), DEFAULT_MIN_STOCK);
  assert.equal(resolveMinStock(undefined), DEFAULT_MIN_STOCK);
});

test('resolveStock treats unusable levels as zero', () => {
  assert.equal(resolveStock({ stock: '7' }), 7);
  assert.equal(resolveStock({ stock: 0 }), 0);
  assert.equal(resolveStock({ stock: null }), 0);
  assert.equal(resolveStock({}), 0);
});

test('resolveStockStatus uses each item threshold, not a fixed 5', () => {
  // The old shared rule was `stock > 5`, so an item with a reorder level of 20
  // was still shown as "In Stock" at 8 units.
  assert.equal(resolveStockStatus(8, 20), 'Low Stock');
  assert.equal(resolveStockStatus(21, 20), 'In Stock');
  assert.equal(resolveStockStatus(5, 5), 'Low Stock');
  assert.equal(resolveStockStatus(6, 5), 'In Stock');
  assert.equal(resolveStockStatus(1, 5), 'Low Stock');
  assert.equal(resolveStockStatus(0, 5), 'Out of Stock');
  assert.equal(resolveStockStatus(-3, 5), 'Out of Stock');
});

test('applyStockDelta deducts a sale', () => {
  const result = applyStockDelta(10, 3, 5);
  assert.deepEqual(result, { stock: 7, status: 'In Stock', shortfall: 0 });
});

test('applyStockDelta returns units when an edit reduces a sale', () => {
  // Editing a sale from 3 units to 1 hands 2 units back. The caller passes the
  // increase in quantity (1 - 3 = -2) so a negative delta returns stock.
  const result = applyStockDelta(7, 1 - 3, 5);
  assert.equal(result.stock, 9);
  assert.equal(result.shortfall, 0);
});

test('applyStockDelta takes the extra units when an edit grows a sale', () => {
  // Editing a sale from 1 unit to 3 must deduct the 2 extra units only.
  const result = applyStockDelta(7, 3 - 1, 5);
  assert.equal(result.stock, 5);
  assert.equal(result.status, 'Low Stock');
  assert.equal(result.shortfall, 0);
});

test('applyStockDelta returns a whole item when an edit changes the product', () => {
  // The original product is handed back in full, which is a negative delta.
  const result = applyStockDelta(7, -3, 5);
  assert.equal(result.stock, 10);
  assert.equal(result.shortfall, 0);
});

test('applyStockDelta restores units when a sale is deleted', () => {
  const result = applyStockDelta(7, -3, 5);
  assert.equal(result.stock, 10);
  assert.equal(result.shortfall, 0);
});

test('applyStockDelta floors at zero but reports the shortfall', () => {
  const result = applyStockDelta(2, 5, 1);
  assert.equal(result.stock, 0, 'a negative stock level is not a quantity');
  assert.equal(result.status, 'Out of Stock');
  assert.equal(result.shortfall, 3, 'the missing units must be surfaced, not lost');
});

test('applyStockDelta leaves stock alone for a zero movement', () => {
  const result = applyStockDelta(4, 0, 5);
  assert.equal(result.stock, 4);
  assert.equal(result.shortfall, 0);
});

test('stock value is measured at cost across every item, not one page', () => {
  const items = [
    { name: 'A', stock: 10, price: 'GHS 20.00', costPrice: 'GHS 12.00' },
    { name: 'B', stock: 5, price: 'GHS 8.00', costPrice: 'GHS 3.50' },
  ];
  // 10 * 12 + 5 * 3.50
  assert.equal(stockValueAtCost(items), 137.5);
  assert.equal(stockRetailValue(items), 240);
  assert.equal(countUnitsInStock(items), 15);
});

test('stock value ignores rows with no cost price but reports them', () => {
  const items = [
    { name: 'A', stock: 10, price: 'GHS 20.00', costPrice: 'GHS 12.00' },
    { name: 'Legacy', stock: 4, price: 'GHS 20.00', costPrice: '' },
  ];
  assert.equal(stockValueAtCost(items), 120);
  assert.deepEqual(countItemsMissingCost(items), 1);
});

test('stock value treats unusable levels as zero units', () => {
  const items = [{ name: 'A', stock: null, price: 'GHS 20.00', costPrice: 'GHS 12.00' }];
  assert.equal(stockValueAtCost(items), 0);
  assert.equal(countUnitsInStock(items), 0);
});

test('net profit subtracts every expense from sales exactly once', () => {
  const sales = [{ amount: 'GHS 500.00' }, { amount: 'GHS 300.00' }];
  const expenses = [{ amount: 'GHS 120.00' }, { amount: 'GH₵ 80.00' }];
  const revenue = sales.reduce((acc, s) => acc + parseAmount(s.amount || s.totalAmount), 0);
  const spend = expenses.reduce((acc, e) => acc + parseAmount(e.amount || e.totalAmount), 0);
  // A paid invoice mirrors a sales row, so revenue must not add it again.
  assert.equal(revenue, 800);
  assert.equal(spend, 200);
  assert.equal(revenue - spend, 600);
});

test('a credit line reduces net profit instead of increasing it', () => {
  const revenue = parseAmount('GHS 500.00') + parseAmount('GHS -50.00');
  assert.equal(revenue, 450);
});
test('cost price stays optional: retail value is complete without any costs', () => {
  const items = [
    { name: 'ChinChin', stock: 10, price: 'GHS 5.00' },
    { name: 'Sardine', stock: 4, price: 'GHS 20.00' },
  ];
  // The maker knows what they sell for, so this figure is always trustworthy.
  assert.equal(stockRetailValue(items), 130);
  assert.equal(countItemsWithCost(items), 0);
  assert.equal(countItemsMissingCost(items), 2);
});

test('margin is withheld until every item has a cost, not estimated from a part', () => {
  const partial = [
    { name: 'ChinChin', stock: 10, price: 'GHS 5.00', costPrice: 'GHS 2.00' },
    { name: 'Sardine', stock: 4, price: 'GHS 20.00' },
  ];
  // Mixing costed and uncosted stock would understate the margin, so it stays hidden.
  assert.equal(grossMarginPercent(partial), null);

  const complete = [
    { name: 'ChinChin', stock: 10, price: 'GHS 5.00', costPrice: 'GHS 2.00' },
    { name: 'Sardine', stock: 4, price: 'GHS 20.00', costPrice: 'GHS 10.00' },
  ];
assert.equal(countItemsWithCost(complete), 2);
  // 130 retail against 60 cost.
  assert.equal(Number(grossMarginPercent(complete).toFixed(2)), 53.85);
});

test('margin refuses to divide by an empty shelf', () => {
    assert.equal(grossMarginPercent([]), null);
  });

// The services dashboard used to compute Net as gross - expenses, ignoring the
// platform fees entirely, while the P&L computed net-of-fees - expenses. The two
// pages therefore disagreed by exactly the fees. These tests pin the shared basis.
test('platform fees are deducted from income, not ignored', () => {
  const income = [
    { amount: 1000, platformFee: 150, netAmount: 850 },
    { amount: 500, platformFee: 0, netAmount: 500 },
  ];
  assert.equal(serviceGross(income), 1500);
  assert.equal(serviceFees(income), 150);
  assert.equal(serviceReceived(income), 1350);
});

test('a row whose net_amount was never computed falls back to its gross amount', () => {
  assert.equal(serviceRowReceived({ amount: 250, platformFee: 10 }), 250);
  assert.equal(serviceRowReceived({ amount: 250, netAmount: null }), 250);
  assert.equal(serviceRowReceived({ amount: 250, netAmount: '' }), 250);
  // net_amount is a nullable column with DEFAULT 0, so a stored 0 means
  // "never computed". Two real rows have amount=1.00, fee=0, net_amount=0.
  assert.equal(serviceRowReceived({ amount: 1, platformFee: 0, netAmount: 0 }), 1);
  assert.equal(serviceReceived([{ amount: 1, platformFee: 0, netAmount: 0 }, { amount: 99, platformFee: 0, netAmount: 99 }]), 100);
});

test('profit is income received minus expenses, never gross minus expenses', () => {
  const income = [
    { amount: 1000, platformFee: 150, netAmount: 850 },
    { amount: 500, platformFee: 0, netAmount: 500 },
  ];
  const expenses = [{ amount: 'GHS 200.00' }, { amount: 'GHS 50.50' }];

  const result = serviceProfit(income, expenses);
  assert.equal(result.gross, 1500);
  assert.equal(result.fees, 150);
  assert.equal(result.received, 1350);
  assert.equal(result.expenses, 250.5);
  assert.equal(result.profit, 1099.5);

  // The old, wrong dashboard figure. It must never be presented as profit.
  const wrongOldDashboardNumber = result.gross - result.expenses;
  assert.equal(wrongOldDashboardNumber, 1249.5);
  assert.notEqual(result.profit, wrongOldDashboardNumber);
  assert.equal(result.profit, wrongOldDashboardNumber - result.fees);
});

test('prefixed and legacy expense strings parse through the shared helper', () => {
  const expenses = [{ amount: 'GHS 1,240.00' }, { amount: 'GH₵ 100.00' }, { amount: '' }, { amount: null }];
  assert.equal(serviceProfit([], expenses).expenses, 1340);
});

test('negative amounts keep their sign through profit', () => {
  const income = [{ amount: 500, platformFee: 0, netAmount: 500 }];
  const expenses = [{ amount: 'GHS -200.00' }];
  assert.equal(serviceProfit(income, expenses).profit, 700);
});

test('margin is null with no income rather than a misleading zero', () => {
  assert.equal(serviceProfit([], [{ amount: 'GHS 100.00' }]).margin, null);
  assert.equal(serviceProfit([{ amount: 400, netAmount: 400 }], [{ amount: 'GHS 100.00' }]).margin, '75.0');
});
