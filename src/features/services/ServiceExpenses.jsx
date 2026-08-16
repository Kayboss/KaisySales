import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from '../../services/api';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitize';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const SearchInput = styled.input`
  padding: 0.65rem 1rem 0.65rem 2.5rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  width: 280px;
  font-size: 0.9rem;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2389726C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") 12px 50% no-repeat;
  @media (max-width: 768px) { width: 100%; }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  &:hover { filter: brightness(1.15); }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  @media (max-width: 768px) { display: none; }
`;

const Th = styled.th`
  text-align: left;
  padding: 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.9rem;
`;

const SubCategoryTag = styled.span`
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ $type, theme }) =>
    $type === 'saas' ? '#E3F2FD' :
    $type === 'subcontractor' ? '#FFF3E0' :
    $type === 'hardware' ? '#F3E5F5' : theme.colors.background.surfaceVariant};
  color: ${({ $type }) =>
    $type === 'saas' ? '#1565C0' :
    $type === 'subcontractor' ? '#E65100' :
    $type === 'hardware' ? '#7B1FA2' : '#555'};
`;

const RenewalBadge = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const AssetBadge = styled.span`
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: #F3E5F5;
  color: #7B1FA2;
  font-weight: 600;
`;

const ActionBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.35rem;
  color: ${({ theme }) => theme.colors.text.muted};
  border-radius: 6px;
  &:hover { background: ${({ theme }) => theme.colors.background.surfaceVariant}; color: ${({ theme }) => theme.colors.primary}; }
`;

const MobileGrid = styled.div`
  display: none;
  @media (max-width: 768px) { display: flex; flex-direction: column; gap: 0.75rem; }
`;

const MobileCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 1rem;
  border-left: 4px solid ${({ $type }) =>
    $type === 'saas' ? '#1565C0' :
    $type === 'subcontractor' ? '#E65100' :
    $type === 'hardware' ? '#7B1FA2' : '#D4AF37'};
`;

const MobileRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.3rem 0;
  font-size: 0.9rem;
  span:first-child { color: ${({ theme }) => theme.colors.text.muted}; font-size: 0.8rem; }
`;

const Label = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 0.35rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  background: white;
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  cursor: pointer;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.25rem;

  h3 {
    font-size: 0.8rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text.muted};
    text-transform: uppercase;
    margin-bottom: 0.35rem;
  }

  .value {
    font-size: 1.5rem;
    font-weight: 900;
    color: ${({ theme }) => theme.colors.primary};
  }

  .sub {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.text.muted};
    margin-top: 0.25rem;
  }
`;

const PAGE_SIZE = 20;

const SUBCATEGORIES = [
  { value: 'general', label: 'General', icon: '📋' },
  { value: 'saas', label: 'SaaS & Subscriptions', icon: '☁️' },
  { value: 'subcontractor', label: 'Subcontractor', icon: '👥' },
  { value: 'hardware', label: 'Hardware & Assets', icon: '💻' },
];

const ServiceExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: '', amount: '', category: 'SaaS & Subscriptions', date: new Date().toISOString().split('T')[0],
    subcategory: 'general', vendor: '', renewalDate: '', isAsset: false, assetLifetime: '', transactionFee: '',
  });

  const load = async () => {
    const data = await fetchExpenses();
    setExpenses(data);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ title: '', amount: '', category: 'SaaS & Subscriptions', date: new Date().toISOString().split('T')[0], subcategory: 'general', vendor: '', renewalDate: '', isAsset: false, assetLifetime: '', transactionFee: '' });
    setModalOpen(true);
  };

  const openEdit = (e) => {
    setEditId(e.id);
    setForm({
      title: e.title, amount: e.amount, category: e.category || 'Other',
      date: e.date || '', subcategory: e.subcategory || 'general',
      vendor: e.vendor || '', renewalDate: e.renewalDate || '',
      isAsset: e.isAsset || false, assetLifetime: e.assetLifetime || '',
      transactionFee: e.transactionFee || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: sanitizeInput(form.title, 100),
      amount: `GH₵${sanitizeNumber(form.amount)}`,
      category: form.category,
      date: form.date || null,
      subcategory: form.subcategory,
      vendor: sanitizeInput(form.vendor, 100),
      renewal_date: form.renewalDate || null,
      is_asset: form.isAsset,
      asset_lifetime_years: form.isAsset ? parseInt(form.assetLifetime) || null : null,
      transaction_fee: sanitizeNumber(form.transactionFee),
    };
    try {
      if (editId) {
        await updateExpense(editId, payload);
      } else {
        await createExpense(payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Failed to save expense', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to delete expense', error);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = expenses.filter(e =>
    (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAmt = expenses.reduce((s, e) => s + (parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0), 0);
  const saasTotal = expenses.filter(e => e.subcategory === 'saas').reduce((s, e) => s + (parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0), 0);
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), []);
  const upcomingRenewals = expenses.filter(e => e.renewalDate && new Date(e.renewalDate) >= new Date() && new Date(e.renewalDate) <= new Date(now + 30 * 24 * 60 * 60 * 1000));

  return (
    <div>
      <Header>
        <Title>Expenses</Title>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SearchInput placeholder="Search expenses..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <AddButton onClick={openAdd}><Plus size={18} /> Add Expense</AddButton>
        </div>
      </Header>

      <StatRow>
        <StatCard>
          <h3>Total Expenses</h3>
          <div className="value">GH₵{totalAmt.toFixed(2)}</div>
          <div className="sub">{expenses.length} entries</div>
        </StatCard>
        <StatCard>
          <h3>SaaS & Subscriptions</h3>
          <div className="value">GH₵{saasTotal.toFixed(2)}</div>
          <div className="sub">{upcomingRenewals.length} renewals due in 30 days</div>
        </StatCard>
        <StatCard>
          <h3>Upcoming Renewals</h3>
          <div className="value" style={{ fontSize: '1.25rem' }}>{upcomingRenewals.length}</div>
          <div className="sub">Next 30 days</div>
        </StatCard>
      </StatRow>

      <Table>
        <thead>
          <tr>
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Amount</Th>
            <Th>Vendor</Th>
            <Th>Date</Th>
            <Th>Renewal</Th>
            <Th style={{ width: 80 }}></Th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(e => {
            const amt = parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0;
            return (
              <tr key={e.id}>
                <Td><strong>{e.title}</strong></Td>
                <Td>
                  <SubCategoryTag $type={e.subcategory}>{e.category}</SubCategoryTag>
                  {e.isAsset && <AssetBadge style={{ marginLeft: '0.35rem' }}>Asset</AssetBadge>}
                </Td>
                <Td>GH₵{amt.toFixed(2)}</Td>
                <Td>{e.vendor || '-'}</Td>
                <Td>{e.date || '-'}</Td>
                <Td>
                  {e.renewalDate ? (
                    <RenewalBadge>
                      <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />
                      {e.renewalDate}
                    </RenewalBadge>
                  ) : '-'}
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <ActionBtn onClick={() => openEdit(e)}><Edit2 size={16} /></ActionBtn>
                    <ActionBtn onClick={() => setDeleteTarget(e.id)}><Trash2 size={16} /></ActionBtn>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <MobileGrid>
        {paginated.map(e => {
          const amt = parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0;
          return (
            <MobileCard key={e.id} $type={e.subcategory}>
              <MobileRow><span>Title</span><span><strong>{e.title}</strong></span></MobileRow>
              <MobileRow>
                <span>Category</span>
                <span><SubCategoryTag $type={e.subcategory}>{e.category}</SubCategoryTag> {e.isAsset && <AssetBadge>Asset</AssetBadge>}</span>
              </MobileRow>
              <MobileRow><span>Amount</span><span>GH₵{amt.toFixed(2)}</span></MobileRow>
              <MobileRow><span>Vendor</span><span>{e.vendor || '-'}</span></MobileRow>
              <MobileRow><span>Date</span><span>{e.date || '-'}</span></MobileRow>
              {e.renewalDate && <MobileRow><span>Renewal</span><span>{e.renewalDate}</span></MobileRow>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                <ActionBtn onClick={() => openEdit(e)}><Edit2 size={16} /></ActionBtn>
                <ActionBtn onClick={() => setDeleteTarget(e.id)}><Trash2 size={16} /></ActionBtn>
              </div>
            </MobileCard>
          );
        })}
        {paginated.length === 0 && <EmptyState>No expenses yet.</EmptyState>}
      </MobileGrid>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <h2 style={{ marginBottom: '1.5rem', color: '#6F240A' }}>{editId ? 'Edit Expense' : 'Add Expense'}</h2>
        <form onSubmit={handleSave}>
          <Label>Title *</Label>
          <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Adobe Creative Cloud" autoFocus />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Amount (GH₵)</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="SaaS & Subscriptions">SaaS & Subscriptions</option>
                <option value="Subcontractor">Subcontractor</option>
                <option value="Hardware & Assets">Hardware & Assets</option>
                <option value="Software">Software</option>
                <option value="Office">Office</option>
                <option value="Transport">Transport</option>
                <option value="Utilities">Utilities</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Subcategory</Label>
              <Select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
                {SUBCATEGORIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Renewal Date</Label>
              <Input type="date" value={form.renewalDate} onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))} />
            </div>
          </div>
          <Checkbox>
            <input type="checkbox" checked={form.isAsset} onChange={e => setForm(f => ({ ...f, isAsset: e.target.value === 'true' ? false : true }))} />
            This is a depreciating asset (laptop, tablet, server, etc.)
          </Checkbox>
          {form.isAsset && (
            <div>
              <Label>Asset Lifetime (years)</Label>
              <Input type="number" value={form.assetLifetime} onChange={e => setForm(f => ({ ...f, assetLifetime: e.target.value }))} placeholder="3" />
            </div>
          )}
          <Label>Transaction / Withdrawal Fee (GH₵)</Label>
          <Input type="number" step="0.01" value={form.transactionFee} onChange={e => setForm(f => ({ ...f, transactionFee: e.target.value }))} placeholder="0.00" />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: saving ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : (editId ? 'Update' : 'Add')} Expense</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} title="Delete Expense" message="Are you sure?" confirmLoading={deleting} />
    </div>
  );
};

export default ServiceExpenses;
