import styled from 'styled-components';
import { Plus, Trash2, Printer } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { SQFT_DIVISOR, freshSizeLine, numOf, solveSizeLines, solvedTotal } from './sizePricing';

const CalcCard = styled.div`
  background: #FCF9F3;
  border: 1px solid #F0EEE8;
  border-radius: 12px;
  padding: 0.85rem;
  margin-bottom: 0.75rem;
`;

const CalcHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
`;

const CalcTitle = styled.span`
  font-weight: 800;
  font-size: 0.82rem;
  color: #6F240A;
`;

const MiniLabel = styled.label`
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #55423D;
  margin-bottom: 0.3rem;
`;

const ThreeCol = styled.div`
  display: grid;
  grid-template-columns: 0.9fr 1fr 1fr;
  gap: 0.5rem;
`;

const ItemNum = styled.input`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #D0C8C4;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.9rem;
  color: #1C1C18;
  outline: none;
  box-sizing: border-box;
  margin: 0;

  &:focus {
    border-color: #6F240A;
    box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
  }
`;

const ItemSelect = styled.select`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #D0C8C4;
  border-radius: 10px;
  font-family: inherit;
  font-size: 0.9rem;
  background: white;
  outline: none;
  box-sizing: border-box;
  margin: 0;

  &:focus {
    border-color: #6F240A;
  }
`;

const ItemResultRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #55423D;
  padding: 0.18rem 0;

  b {
    color: #1C1C18;
  }
`;

const AddItemBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.55rem;
  border: 1px dashed #D0C8C4;
  border-radius: 10px;
  background: white;
  color: #6F240A;
  font-weight: 700;
  font-size: 0.82rem;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #F5F3F0;
    border-color: #6F240A;
  }
`;

const CalcTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  font-weight: 800;
  color: white;
  background: #25432F;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-top: 0.6rem;
`;

const SubBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1rem;
  border: 1px solid #D0C8C4;
  border-radius: 10px;
  background: white;
  color: #6F240A;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #F5F3F0;
  }
`;

const CalcScaleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const ScaleNote = styled.span`
  font-size: 0.78rem;
  color: #89726C;
`;

const UnitLabel = styled.span`
  font-size: 0.85rem;
  color: #55423D;
  font-weight: 600;
  white-space: nowrap;
`;

const Warn = styled.p`
  font-size: 0.78rem;
  color: #875200;
  margin: -0.25rem 0 0.75rem;
`;

const SizePricingCalculator = ({ lines, onChange, pricePerSqFt, onPrint, emptyRateHint }) => {
  const solved = solveSizeLines(lines, pricePerSqFt);
  const validLines = solved.filter(s => s.valid);
  const total = solvedTotal(solved);

  const update = (idx, patch) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <div>
      <CalcScaleRow>
        <UnitLabel>Price per sq ft: {formatCurrency(numOf(pricePerSqFt))}</UnitLabel>
        <ScaleNote>Feet: (L×H)×P×Q • Inches/CM: (L×H÷{SQFT_DIVISOR})×P×Q • Total rounds up to whole cedis</ScaleNote>
      </CalcScaleRow>
      {numOf(pricePerSqFt) === 0 && (
        <Warn>{emptyRateHint || 'Set a price per sq ft in Service Catalog, or the account default, to price by size.'}</Warn>
      )}

      {solved.map((c, idx) => (
        <CalcCard key={c.key}>
          <CalcHead>
            <CalcTitle>Item {idx + 1}</CalcTitle>
            {solved.length > 1 && (
              <button type="button" onClick={() => onChange(lines.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BA1A1A', display: 'flex', padding: '0.2rem' }} aria-label={`Remove item ${idx + 1}`}>
                <Trash2 size={15} />
              </button>
            )}
          </CalcHead>
          <MiniLabel>Description</MiniLabel>
          <ItemNum type="text" value={c.label} onChange={e => update(idx, { label: e.target.value })} placeholder="e.g. Banner 10×5 ft" style={{ marginBottom: '0.6rem' }} />
          <ThreeCol>
            <div>
              <MiniLabel>Units</MiniLabel>
              <ItemSelect value={c.unit} onChange={e => update(idx, { unit: e.target.value })}>
                <option value="feet">ft</option>
                <option value="inches">in</option>
                <option value="cm">cm</option>
              </ItemSelect>
            </div>
            <div>
              <MiniLabel>Length (L)</MiniLabel>
              <ItemNum type="number" min="0" step="any" value={c.length} onChange={e => update(idx, { length: e.target.value })} placeholder="0" />
            </div>
            <div>
              <MiniLabel>Height (H)</MiniLabel>
              <ItemNum type="number" min="0" step="any" value={c.height} onChange={e => update(idx, { height: e.target.value })} placeholder="0" />
            </div>
          </ThreeCol>
          <div style={{ marginTop: '0.6rem' }}>
            <MiniLabel>Quantity (Q)</MiniLabel>
            <ItemNum type="number" min="1" step="1" value={c.quantity} onChange={e => update(idx, { quantity: e.target.value })} placeholder="1" />
          </div>
          <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #D0C8C4', paddingTop: '0.4rem' }}>
            <ItemResultRow><span>Quantity ×</span><b>{c.Q}</b></ItemResultRow>
            <ItemResultRow style={{ fontWeight: 800, color: '#1C1C18', fontSize: '0.95rem' }}>
              <span>Item {idx + 1} total</span>
              <b style={{ color: '#25432F' }}>{c.valid ? `${formatCurrency(c.total)}` : '—'}</b>
            </ItemResultRow>
          </div>
        </CalcCard>
      ))}

      <AddItemBtn type="button" onClick={() => onChange([...lines, freshSizeLine()])}><Plus size={16} /> Add Item</AddItemBtn>

      <CalcTotal>
        <span>Grand Total</span>
        <span>{formatCurrency(total)}</span>
      </CalcTotal>

      {onPrint && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <SubBtn type="button" onClick={onPrint} disabled={validLines.length === 0} style={{ opacity: validLines.length === 0 ? 0.5 : 1, cursor: validLines.length === 0 ? 'not-allowed' : 'pointer' }}>
            <Printer size={15} /> Print Quote
          </SubBtn>
        </div>
      )}
    </div>
  );
};

export default SizePricingCalculator;
