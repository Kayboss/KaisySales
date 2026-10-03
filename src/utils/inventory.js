import { parseAmount } from './currency.js';

export const DEFAULT_MIN_STOCK = 5;

export const resolveMinStock = (item) => {
  const raw = item?.minStock ?? item?.min_stock;
  if (raw === null || raw === undefined || raw === '') return DEFAULT_MIN_STOCK;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_STOCK;
};

export const resolveStock = (item) => {
  const parsed = parseInt(item?.stock, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const resolveStockStatus = (stock, minStock) => {
  const level = Number.isFinite(stock) ? stock : 0;
  const threshold = Number.isFinite(minStock) ? minStock : DEFAULT_MIN_STOCK;
  if (level <= 0) return 'Out of Stock';
  return level <= threshold ? 'Low Stock' : 'In Stock';
};

// `delta` is the number of units leaving stock, so a positive delta deducts and
// a negative one returns. The level is floored at zero because a negative stock
// level is not a meaningful quantity; callers are expected to surface
// `shortfall` to the user instead of silently losing units, since a floor would
// otherwise make the recorded sale disagree with the inventory it came from.
export const applyStockDelta = (currentStock, delta, minStock) => {
  const level = Number.isFinite(currentStock) ? currentStock : 0;
  const change = Number.isFinite(delta) ? delta : 0;
  const next = level - change;
  return {
    stock: Math.max(0, next),
    status: resolveStockStatus(Math.max(0, next), minStock),
    shortfall: next < 0 ? Math.abs(next) : 0,
  };
};

// Stock sitting on the shelf is money already spent, so it is valued at cost.
// Cost is priced per unit, so stock units multiply the unit cost.
export const stockValueAtCost = (items) =>
  items.reduce((sum, item) => sum + resolveStock(item) * parseAmount(item.costPrice), 0);

export const stockRetailValue = (items) =>
  items.reduce((sum, item) => sum + resolveStock(item) * parseAmount(item.price), 0);

export const countUnitsInStock = (items) =>
  items.reduce((sum, item) => sum + resolveStock(item), 0);

// Cost price is optional. Most makers know what they sell for but not what the
// materials cost, so a missing cost is a normal state and never blocks anything.
export const countItemsMissingCost = (items) =>
  items.filter(item => parseAmount(item.costPrice) <= 0).length;

export const countItemsWithCost = (items) =>
  items.filter(item => parseAmount(item.costPrice) > 0).length;

// Margin is only meaningful once every item in view has a cost, otherwise the
// figure silently mixes costed and uncosted stock. Returns null when incomplete.
export const grossMarginPercent = (items) => {
  if (items.length === 0) return null;
  if (countItemsMissingCost(items) > 0) return null;
  const retail = stockRetailValue(items);
  if (retail <= 0) return null;
  const cost = stockValueAtCost(items);
  return ((retail - cost) / retail) * 100;
};