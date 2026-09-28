import styled from 'styled-components';

const Select = styled.select`
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  background: white;
`;

const num = (v) => parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;

const label = (s) => {
  const flat = num(s.price);
  const perSqFt = num(s.areaPrice);
  const cat = s.category ? ` (${s.category})` : '';
  if (perSqFt > 0 && flat > 0) return `${s.name} — GH₵${flat.toFixed(2)} or GH₵${perSqFt.toFixed(2)}/sq ft${cat}`;
  if (perSqFt > 0) return `${s.name} — GH₵${perSqFt.toFixed(2)}/sq ft${cat}`;
  return `${s.name} — GH₵${flat.toFixed(2)}${cat}`;
};

const CatalogPicker = ({ services, onPick }) => (
  <Select
    value=""
    onChange={e => {
      const svc = services.find(s => String(s.id) === e.target.value);
      if (svc) onPick(svc);
      e.target.value = '';
    }}
    aria-label="Quick add from service catalog"
  >
    <option value="">⚡ Quick add from catalog...</option>
    {services.map(s => (
      <option key={s.id} value={s.id}>{label(s)}</option>
    ))}
  </Select>
);

export default CatalogPicker;