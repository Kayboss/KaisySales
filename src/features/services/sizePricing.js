export const SQFT_DIVISOR = 144;

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const roundUp = (n) => Math.ceil(round2(n) - 1e-9);

export const numOf = (v) => parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;

export const unitLabel = (u) => (u === 'feet' ? 'ft' : u === 'inches' ? 'in' : 'cm');

let seq = 0;

export const freshSizeLine = () => ({
  key: `sz-${Date.now().toString(36)}-${(seq++).toString(36)}`,
  label: '',
  unit: 'feet',
  length: '',
  height: '',
  quantity: 1
});

export const solveSizeLines = (lines, pricePerSqFt) => {
  const P = Math.max(0, numOf(pricePerSqFt));
  return (lines || []).map(l => {
    const L = numOf(l.length);
    const H = numOf(l.height);
    const Q = Math.max(1, Math.round(numOf(l.quantity)) || 1);
    const divisorEff = l.unit === 'feet' ? 1 : SQFT_DIVISOR;
    const area = (L * H) / divisorEff;
    const itemPrice = round2(area * P);
    return { ...l, L, H, Q, P, divisorEff, area, itemPrice, total: round2(itemPrice * Q), valid: L > 0 && H > 0 };
  });
};

export const solvedTotal = (solved) => roundUp((solved || []).filter(s => s.valid).reduce((sum, s) => sum + s.total, 0));
