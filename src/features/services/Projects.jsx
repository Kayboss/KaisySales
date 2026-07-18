import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Search, Edit2, Trash2, Briefcase, CheckCircle, Clock, PauseCircle, XCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchProjects, createProject, updateProject, deleteProject, fetchCustomers } from '../../services/api';
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
  border-radius: ${({ theme }) => theme.borderRadius.md};
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

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${({ $status, theme }) =>
    $status === 'active' ? '#E8F5E9' :
    $status === 'completed' ? '#E3F2FD' :
    $status === 'on_hold' ? '#FFF3E0' : '#FFEBEE'};
  color: ${({ $status }) =>
    $status === 'active' ? '#2E7D32' :
    $status === 'completed' ? '#1565C0' :
    $status === 'on_hold' ? '#E65100' : '#C62828'};
`;

const PlatformTag = styled.span`
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.text.muted};
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

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const STATUS_ICONS = {
  active: <Clock size={14} />,
  completed: <CheckCircle size={14} />,
  on_hold: <PauseCircle size={14} />,
  cancelled: <XCircle size={14} />,
};

const PAGE_SIZE = 20;

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '', clientName: '', description: '', budget: '', status: 'active',
    platformTag: 'direct', startDate: '', endDate: '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [data, cust] = await Promise.all([fetchProjects(), fetchCustomers()]);
    setProjects(data);
    setCustomers(cust);
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', clientName: '', description: '', budget: '', status: 'active', platformTag: 'direct', startDate: '', endDate: '' });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      name: p.name, clientName: p.clientName || '', description: p.description || '',
      budget: p.budget || '', status: p.status || 'active', platformTag: p.platformTag || 'direct',
      startDate: p.startDate || '', endDate: p.endDate || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: sanitizeInput(form.name, 100),
      client_name: sanitizeInput(form.clientName, 100),
      description: sanitizeInput(form.description, 500),
      budget: sanitizeNumber(form.budget),
      status: form.status,
      platform_tag: form.platformTag,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
    };
    try {
      if (editId) {
        await updateProject(editId, payload);
      } else {
        await createProject(payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Failed to save project', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(deleteTarget);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to delete project', error);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Header>
        <Title>Projects</Title>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SearchInput placeholder="Search projects..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <AddButton onClick={openAdd}><Plus size={18} /> New Project</AddButton>
        </div>
      </Header>

      <Table>
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Client</Th>
            <Th>Budget</Th>
            <Th>Platform</Th>
            <Th>Status</Th>
            <Th style={{ width: 80 }}></Th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(p => (
            <tr key={p.id}>
              <Td><strong>{p.name}</strong></Td>
              <Td>{p.clientName || '-'}</Td>
              <Td>GH₵{parseFloat(p.budget || 0).toFixed(2)}</Td>
              <Td><PlatformTag>{p.platformTag}</PlatformTag></Td>
              <Td><StatusBadge $status={p.status}>{STATUS_ICONS[p.status]} {p.status}</StatusBadge></Td>
              <Td>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <ActionBtn onClick={() => openEdit(p)}><Edit2 size={16} /></ActionBtn>
                  <ActionBtn onClick={() => setDeleteTarget(p.id)}><Trash2 size={16} /></ActionBtn>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <MobileGrid>
        {paginated.map(p => (
          <MobileCard key={p.id}>
            <MobileRow><span>Project</span><span><strong>{p.name}</strong></span></MobileRow>
            <MobileRow><span>Client</span><span>{p.clientName || '-'}</span></MobileRow>
            <MobileRow><span>Budget</span><span>GH₵{parseFloat(p.budget || 0).toFixed(2)}</span></MobileRow>
            <MobileRow><span>Platform</span><span><PlatformTag>{p.platformTag}</PlatformTag></span></MobileRow>
            <MobileRow><span>Status</span><StatusBadge $status={p.status}>{STATUS_ICONS[p.status]} {p.status}</StatusBadge></MobileRow>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <ActionBtn onClick={() => openEdit(p)}><Edit2 size={16} /></ActionBtn>
              <ActionBtn onClick={() => setDeleteTarget(p.id)}><Trash2 size={16} /></ActionBtn>
            </div>
          </MobileCard>
        ))}
        {paginated.length === 0 && <EmptyState>No projects yet.</EmptyState>}
      </MobileGrid>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <h2 style={{ marginBottom: '1.5rem', color: '#6F240A' }}>{editId ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={handleSave}>
          <Label>Project Name *</Label>
          <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Website Redesign" autoFocus />
          <Label>Client</Label>
          {customers.length > 0 ? (
            <Select value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}>
              <option value="">-- Select a customer --</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </Select>
          ) : (
            <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client or company name" />
          )}
          <Label>Description</Label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Budget (GH₵)</Label>
              <Input type="number" step="0.01" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Platform</Label>
              <Select value={form.platformTag} onChange={e => setForm(f => ({ ...f, platformTag: e.target.value }))}>
                <option value="direct">Direct Client</option>
                <option value="upwork">Upwork</option>
                <option value="fiverr">Fiverr</option>
                <option value="freelancer">Freelancer</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <Label>Status</Label>
          <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: saving ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : (editId ? 'Update' : 'Create')} Project</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} title="Delete Project" message="Are you sure?" confirmLoading={deleting} />
    </div>
  );
};

export default Projects;
