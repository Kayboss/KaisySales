import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Tag, Edit2, Trash2, Check, X, DollarSign, Save } from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchServices, createService, updateService, deleteService, fetchCategories } from '../../services/api';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitize';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';

const Card = styled.div`
  background: white;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  max-width: 760px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const DefaultsCard = styled.div`
  background: #FCF9F3;
  border: 1px solid #F0EEE8;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
`;

const DefaultsHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const DefaultsTitle = styled.span`
  font-weight: 800;
  font-size: 0.9rem;
  color: #6F240A;
`;

const DefaultsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
`;

const DefaultField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 140px;
`;

const DefaultLabel = styled.label`
  font-size: 0.72rem;
  font-weight: 700;
  color: #89726C;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.main};
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const RowInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 180px;
  flex-wrap: wrap;
`;

const Name = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.main};
`;

const Price = styled.span`
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.95rem;
`;

const CatTag = styled.span`
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.text.muted};
`;

const AreaTag = styled.span`
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(37, 67, 47, 0.1);
  color: #25432F;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${props => props.$danger ? '#BA1A1A' : '#89726C'};
  padding: 0.25rem;
  display: flex;
  align-items: center;
  border-radius: 4px;

  &:hover { background: rgba(0,0,0,0.05); }
`;

const AddRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
`;

const Input = styled.input`
  flex: 1;
  min-width: 140px;
  padding: 0.6rem 0.85rem;
  border: 1px solid #D0C8C4;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;

  &:focus {
    border-color: #6F240A;
  }
`;

const AddBtn = styled.button`
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 8px;
  background: ${props => props.disabled ? '#997A6F' : '#6F240A'};
  color: white;
  font-weight: 600;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 0.85rem;
  white-space: nowrap;
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #89726C;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0.75rem 0;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #F0EEE8;
  }
`;

const EmptyState = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
`;

const Hint = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
`;

const SuccessNote = styled.span`
  color: #25432F;
  font-size: 0.8rem;
  font-weight: 600;
`;

const areaNum = (v) => {
  if (v === '' || v === undefined || v === null) return '';
  return String(sanitizeNumber(v));
};

const ServiceCatalog = () => {
  const settings = useSettingsStore();
  const { user } = useAuthStore();
  const [services, setServices] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [addAreaPrice, setAddAreaPrice] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAreaPrice, setEditAreaPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [defPrice, setDefPrice] = useState(settings.areaPrice || '');
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  const load = async () => {
    const [svcs, cats] = await Promise.all([fetchServices(), fetchCategories('income')]);
    setServices(svcs);
    setSuggestions(cats.map(c => c.name));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const handleSaveDefaults = async () => {
    if (!user) return;
    setSavingDefaults(true);
    setDefaultsSaved(false);
    try {
      await settings.updateSettings(user.uid, {
        areaPrice: defPrice.trim() === '' ? '0' : areaNum(defPrice),
      });
      setDefaultsSaved(true);
      setTimeout(() => setDefaultsSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save area defaults', error);
      alert('Could not save defaults. Please try again.');
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await createService({
        name: sanitizeInput(name.trim(), 100),
        price: sanitizeNumber(price),
        category: sanitizeInput(category.trim(), 50),
        areaPrice: addAreaPrice.trim() === '' ? '' : areaNum(addAreaPrice),
      });
      setName(''); setPrice(''); setCategory(''); setAddAreaPrice('');
      await load();
    } catch (error) {
      console.error('Failed to add service', error);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setEditName(s.name || '');
    setEditPrice(s.price || '');
    setEditCategory(s.category || '');
    setEditAreaPrice(s.areaPrice ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateService(editingId, {
        name: sanitizeInput(editName.trim(), 100),
        price: sanitizeNumber(editPrice),
        category: sanitizeInput(editCategory.trim(), 50),
        areaPrice: editAreaPrice.trim() === '' ? '' : areaNum(editAreaPrice),
      });
      setEditingId(null);
      await load();
    } catch (error) {
      console.error('Failed to update service', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to delete service', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <Header>
        <div>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Service Catalog</h2>
          <p style={{ color: '#55423D', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Predefined services with default prices for quick entry.
          </p>
        </div>
      </Header>

      <DefaultsCard>
        <DefaultsHead>
          <DefaultsTitle>Area Pricing Defaults</DefaultsTitle>
          {defaultsSaved && <SuccessNote>Saved ✓</SuccessNote>}
        </DefaultsHead>
        <DefaultsRow>
          <DefaultField>
            <DefaultLabel>Price per Sq. Foot (GH₵)</DefaultLabel>
            <Input type="number" min="0" step="0.01" value={defPrice} onChange={e => setDefPrice(e.target.value)} placeholder="e.g. 4.70" style={{ minWidth: 120, flex: 1 }} />
          </DefaultField>
          <AddBtn type="button" onClick={handleSaveDefaults} disabled={savingDefaults}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Save size={14} /> {savingDefaults ? 'Saving...' : 'Save'}</span>
          </AddBtn>
        </DefaultsRow>
        <p style={{ fontSize: '0.75rem', color: '#89726C', margin: '0.6rem 0 0' }}>
          Used by the Price Calculator when a service has no price per sq ft of its own. Feet: (L × H) × P × Q • Inches/CM: (L × H ÷ 144) × P × Q.
        </p>
      </DefaultsCard>

      <Hint>These appear as a quick-add picker when adding services. Give a service a Price per sq ft to price it by size in the calculator.</Hint>

      <form onSubmit={handleAdd}>
        <AddRow>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Service name (e.g. Banner printing)" autoFocus />
          <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price (GH₵)" style={{ minWidth: 110, maxWidth: 160 }} />
          <Input list="catalog-cat-suggestions" value={category} onChange={e => setCategory(e.target.value)} placeholder="Category (optional)" style={{ minWidth: 130 }} />
          <datalist id="catalog-cat-suggestions">
            {suggestions.map(c => <option key={c} value={c} />)}
          </datalist>
          <AddBtn type="submit" disabled={adding || !name.trim()}>
            {adding ? 'Adding...' : '+ Add Service'}
          </AddBtn>
        </AddRow>
        <Divider>Optional size pricing (per sq ft)</Divider>
        <AddRow>
          <Input type="number" min="0" step="0.01" value={addAreaPrice} onChange={e => setAddAreaPrice(e.target.value)} placeholder="Price per sq ft — GH₵ (optional)" style={{ maxWidth: 260 }} />
        </AddRow>
      </form>

      {services.length === 0 ? (
        <EmptyState>No services in your catalog yet. Add your most common services above.</EmptyState>
      ) : (
        <List>
          {services.map(s => (
            <Row key={s.id}>
              {editingId === s.id ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }} />
                    <Input type="number" min="0" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ minWidth: 100, maxWidth: 140 }} />
                    <Input list="catalog-cat-suggestions" value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ minWidth: 120 }} />
                    <datalist id="catalog-cat-suggestions" />
                    <Actions>
                      <IconBtn disabled={savingEdit} onClick={handleSaveEdit} style={{ opacity: savingEdit ? 0.5 : 1 }}><Check size={16} /></IconBtn>
                      <IconBtn onClick={() => setEditingId(null)}><X size={16} /></IconBtn>
                    </Actions>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Input type="number" min="0" step="0.01" value={editAreaPrice} onChange={e => setEditAreaPrice(e.target.value)} placeholder="Price per sq ft — GH₵ (optional)" style={{ maxWidth: 240 }} />
                  </div>
                </div>
              ) : (
                <>
                  <RowInfo>
                    <Tag size={16} color="#89726C" />
                    <Name>{s.name}</Name>
                    <Price><DollarSign size={12} style={{ verticalAlign: 'middle' }} />{parseFloat(s.price || 0).toFixed(2)}</Price>
                    {s.category && <CatTag>{s.category}</CatTag>}
                    {s.areaPrice !== undefined && s.areaPrice !== '' && (
                      <AreaTag><DollarSign size={11} style={{ verticalAlign: 'middle' }} />{parseFloat(s.areaPrice).toFixed(2)}/sq ft</AreaTag>
                    )}
                  </RowInfo>
                  <Actions>
                    <IconBtn onClick={() => openEdit(s)}><Edit2 size={16} /></IconBtn>
                    <IconBtn $danger onClick={() => setDeleteTarget(s)}><Trash2 size={16} /></IconBtn>
                  </Actions>
                </>
              )}
            </Row>
          ))}
        </List>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Service"
        message={`Delete "${deleteTarget?.name}" from your catalog? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLoading={deleting}
      />
    </Card>
  );
};

export default ServiceCatalog;