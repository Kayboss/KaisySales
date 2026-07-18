import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Search, Edit2, Trash2, Mail, Phone, MapPin, User } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../services/api';
import { sanitizeInput } from '../../utils/sanitize';

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
  border-radius: ${({ theme }) => theme.borderRadius.md};
  width: 280px;
  font-size: 0.9rem;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2389726C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") 12px 50% no-repeat;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover { filter: brightness(1.15); }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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

const ActionBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.35rem;
  color: ${({ theme }) => theme.colors.text.muted};
  border-radius: 6px;

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const MobileGrid = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const MobileCard = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 1rem;
`;

const MobileRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.9rem;

  span:first-child {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.8rem;
  }
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
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.9rem;
  margin-bottom: 1rem;
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.9rem;
  margin-bottom: 1rem;
  resize: vertical;
  font-family: inherit;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.95rem;
`;

const PAGE_SIZE = 20;

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', notes: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await fetchCustomers();
    setCustomers(data);
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', email: '', phone: '', location: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', location: c.location || '', notes: c.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: sanitizeInput(form.name, 100),
      email: sanitizeInput(form.email, 100),
      phone: sanitizeInput(form.phone, 30),
      location: sanitizeInput(form.location, 200),
      notes: sanitizeInput(form.notes, 500),
    };
    try {
      if (editId) {
        await updateCustomer(editId, payload);
      } else {
        await createCustomer(payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Failed to save customer', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to delete customer', error);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Header>
        <Title>Customers</Title>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SearchInput placeholder="Search customers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <AddButton onClick={openAdd}><Plus size={18} /> Add Customer</AddButton>
        </div>
      </Header>

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Location</Th>
            <Th style={{ width: 80 }}></Th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(c => (
            <tr key={c.id}>
              <Td><strong>{c.name}</strong></Td>
              <Td>{c.email || '-'}</Td>
              <Td>{c.phone || '-'}</Td>
              <Td>{c.location || '-'}</Td>
              <Td>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <ActionBtn onClick={() => openEdit(c)}><Edit2 size={16} /></ActionBtn>
                  <ActionBtn onClick={() => setDeleteTarget(c.id)}><Trash2 size={16} /></ActionBtn>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <MobileGrid>
        {paginated.map(c => (
          <MobileCard key={c.id}>
            <MobileRow>
              <span>Name</span>
              <span><strong>{c.name}</strong></span>
            </MobileRow>
            <MobileRow>
              <span>Email</span>
              <span>{c.email || '-'}</span>
            </MobileRow>
            <MobileRow>
              <span>Phone</span>
              <span>{c.phone || '-'}</span>
            </MobileRow>
            <MobileRow>
              <span>Location</span>
              <span>{c.location || '-'}</span>
            </MobileRow>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <ActionBtn onClick={() => openEdit(c)}><Edit2 size={16} /></ActionBtn>
              <ActionBtn onClick={() => setDeleteTarget(c.id)}><Trash2 size={16} /></ActionBtn>
            </div>
          </MobileCard>
        ))}
        {paginated.length === 0 && <EmptyState>No customers found.</EmptyState>}
      </MobileGrid>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <h2 style={{ marginBottom: '1.5rem', color: '#6F240A' }}>{editId ? 'Edit Customer' : 'Add Customer'}</h2>
        <form onSubmit={handleSave}>
          <Label>Full Name *</Label>
          <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" autoFocus />
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" />
          <Label>Location</Label>
          <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Region" />
          <Label>Notes</Label>
          <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: saving ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : (editId ? 'Update' : 'Add')} Customer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Customer"
        message="Are you sure you want to delete this customer?"
        confirmLoading={deleting}
      />
    </div>
  );
};

export default Customers;
