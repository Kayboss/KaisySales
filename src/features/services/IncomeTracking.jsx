import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Edit2, Trash2, RefreshCw, DollarSign } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchServiceIncome, createServiceIncome, updateServiceIncome, deleteServiceIncome, fetchRecurringIncome, createRecurringIncome, updateRecurringIncome, deleteRecurringIncome, fetchCustomers, fetchExpenses } from '../../services/api';
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

const TabBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding-bottom: 0;
`;

const Tab = styled.button`
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  font-weight: 700;
  font-size: 0.9rem;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.text.muted};
  border-bottom: 2px solid ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { color: ${({ theme }) => theme.colors.primary}; }
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

const FeeTag = styled.span`
  font-size: 0.8rem;
  color: #C62828;
`;

const NetTag = styled.span`
  font-size: 0.8rem;
  color: #2E7D32;
  font-weight: 700;
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

const FeeCalcBox = styled.div`
  background: #FFF8E1;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: #795548;
`;

const PAGE_SIZE = 20;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ChartBox = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
`;

const ChartTitle = styled.h3`
  font-size: 1rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const IncomeTracking = () => {
  const [tab, setTab] = useState('income');
  const [income, setIncome] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [incomeForm, setIncomeForm] = useState({
    clientName: '', amount: '', platformFee: '', netAmount: '',
    platformTag: 'direct', milestoneLabel: '', paymentDate: '', notes: '',
  });
  const [recurForm, setRecurForm] = useState({
    clientName: '', amount: '', frequency: 'monthly', nextDueDate: '', category: '',
  });
  const [recurModal, setRecurModal] = useState(false);
  const [recurEditId, setRecurEditId] = useState(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState(null);
  const [savingIncome, setSavingIncome] = useState(false);
  const [savingRecur, setSavingRecur] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const [i, r, c, ex] = await Promise.all([fetchServiceIncome(), fetchRecurringIncome(), fetchCustomers(), fetchExpenses()]);
    setIncome(i);
    setRecurring(r);
    setCustomers(c);
    setExpenses(ex);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  // Income
  const calcNet = (amount, fee) => {
    const a = parseFloat(amount) || 0;
    const f = parseFloat(fee) || 0;
    return (a - f).toFixed(2);
  };

  const openAddIncome = () => {
    setEditId(null);
    setIncomeForm({ clientName: '', amount: '', platformFee: '', netAmount: '', platformTag: 'direct', milestoneLabel: '', paymentDate: '', notes: '' });
    setModalOpen(true);
  };

  const openEditIncome = (item) => {
    setEditId(item.id);
    setIncomeForm({
      clientName: item.clientName || '', amount: item.amount || '',
      platformFee: item.platformFee || '', netAmount: item.netAmount || '', platformTag: item.platformTag || 'direct',
      milestoneLabel: item.milestoneLabel || '', paymentDate: item.paymentDate || '', notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveIncome = async (e) => {
    e.preventDefault();
    setSavingIncome(true);
    const amount = sanitizeNumber(incomeForm.amount);
    const platformFee = sanitizeNumber(incomeForm.platformFee);
    const payload = {
      client_name: sanitizeInput(incomeForm.clientName, 100),
      amount,
      platform_fee: platformFee,
      net_amount: parseFloat(calcNet(amount, platformFee)),
      platform_tag: incomeForm.platformTag,
      milestone_label: sanitizeInput(incomeForm.milestoneLabel, 100),
      payment_date: incomeForm.paymentDate || null,
      notes: sanitizeInput(incomeForm.notes, 500),
    };
    try {
      if (editId) {
        await updateServiceIncome(editId, payload);
      } else {
        await createServiceIncome(payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Failed to save income', error);
    } finally {
      setSavingIncome(false);
    }
  };

  // Recurring
  const openAddRecur = () => {
    setRecurEditId(null);
    setRecurForm({ clientName: '', amount: '', frequency: 'monthly', nextDueDate: '', category: '' });
    setRecurModal(true);
  };

  const openEditRecur = (item) => {
    setRecurEditId(item.id);
    setRecurForm({ clientName: item.clientName, amount: item.amount, frequency: item.frequency, nextDueDate: item.nextDueDate || '', category: item.category || '' });
    setRecurModal(true);
  };

  const handleSaveRecur = async (e) => {
    e.preventDefault();
    setSavingRecur(true);
    const payload = {
      client_name: sanitizeInput(recurForm.clientName, 100),
      amount: sanitizeNumber(recurForm.amount),
      frequency: recurForm.frequency,
      next_due_date: recurForm.nextDueDate || null,
      category: sanitizeInput(recurForm.category, 50),
    };
    try {
      if (recurEditId) {
        await updateRecurringIncome(recurEditId, payload);
      } else {
        await createRecurringIncome(payload);
      }
      setRecurModal(false);
      await load();
    } catch (error) {
      console.error('Failed to save recurring income', error);
    } finally {
      setSavingRecur(false);
    }
  };

  // Filtering
  const filteredIncome = income.filter(i =>
    (i.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.milestoneLabel || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredIncome.length / PAGE_SIZE);
  const paginated = filteredIncome.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalGross = income.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0), 0);
  const totalNet = totalGross - totalExpenses;
  const activeRecurring = recurring.filter(r => r.active !== false);
  const monthlyRecurring = activeRecurring.reduce((s, r) => {
    if (r.frequency === 'monthly') return s + (parseFloat(r.amount) || 0);
    if (r.frequency === 'quarterly') return s + (parseFloat(r.amount) || 0) / 3;
    if (r.frequency === 'yearly') return s + (parseFloat(r.amount) || 0) / 12;
    return s;
  }, 0);

  const monthlyData = {};
  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { label: MONTHS[d.getMonth()], income: 0, expenses: 0 };
  }
  income.forEach(i => {
    const pd = i.paymentDate;
    if (!pd) return;
    const d = new Date(pd);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) monthlyData[key].income += parseFloat(i.amount) || 0;
  });
  expenses.forEach(e => {
    const ed = e.date;
    if (!ed) return;
    const d = new Date(ed);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) monthlyData[key].expenses += parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0;
  });
  const chartMonths = Object.keys(monthlyData);
  const chartData = chartMonths.map(key => ({
    name: monthlyData[key].label,
    Income: monthlyData[key].income,
    Expenses: monthlyData[key].expenses,
  }));

  return (
    <div>
      <Header>
        <Title>Dashboard</Title>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SearchInput placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          {tab === 'income' && <AddButton onClick={openAddIncome}><Plus size={18} /> Add Income</AddButton>}
          {tab === 'recurring' && <AddButton onClick={openAddRecur}><Plus size={18} /> Add Recurring</AddButton>}
        </div>
      </Header>

      <StatRow>
        <StatCard>
          <h3>Gross Income</h3>
          <div className="value">GH₵{totalGross.toFixed(2)}</div>
          <div className="sub">Before fees</div>
        </StatCard>
        <StatCard>
          <h3>Total Expenses</h3>
          <div className="value" style={{ color: '#C62828' }}>GH₵{totalExpenses.toFixed(2)}</div>
          <div className="sub">{expenses.length} expense entries</div>
        </StatCard>
        <StatCard>
          <h3>Net Income</h3>
          <div className="value" style={{ color: '#2E7D32' }}>GH₵{totalNet.toFixed(2)}</div>
          <div className="sub">Gross income minus expenses</div>
        </StatCard>
        <StatCard>
          <h3>Monthly Recurring</h3>
          <div className="value">GH₵{monthlyRecurring.toFixed(2)}</div>
          <div className="sub">From {activeRecurring.length} active item(s)</div>
        </StatCard>
      </StatRow>

      <ChartBox>
        <ChartTitle>Monthly Revenue (Last 6 Months)</ChartTitle>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#25432F" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#25432F" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C62828" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#C62828" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#89726C' }} tickLine={false} axisLine={{ stroke: '#E8E5DF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #E8E5DF', fontSize: 13 }}
              formatter={(value, name) => [`GH₵${Number(value).toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Income" stroke="#25432F" strokeWidth={2.5} fill="url(#gradIncome)" dot={{ r: 4, fill: '#25432F', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Area type="monotone" dataKey="Expenses" stroke="#C62828" strokeWidth={2.5} fill="url(#gradExpense)" strokeDasharray="6 3" dot={{ r: 4, fill: '#C62828', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>

      <TabBar>
        <Tab $active={tab === 'income'} onClick={() => setTab('income')}>
          <DollarSign size={16} /> One-Time Payments
        </Tab>
        <Tab $active={tab === 'recurring'} onClick={() => setTab('recurring')}>
          <RefreshCw size={16} /> Recurring Income
        </Tab>
      </TabBar>

      {tab === 'income' && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Milestone</Th>
                <Th>Gross</Th>
                <Th>Fee</Th>
                <Th>Net</Th>
                <Th>Platform</Th>
                <Th>Date</Th>
                <Th style={{ width: 80 }}></Th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(i => (
                <tr key={i.id}>
                  <Td><strong>{i.clientName || '-'}</strong></Td>
                  <Td>{i.milestoneLabel || '-'}</Td>
                  <Td>GH₵{parseFloat(i.amount || 0).toFixed(2)}</Td>
                  <Td><FeeTag>-GH₵{parseFloat(i.platformFee || 0).toFixed(2)}</FeeTag></Td>
                  <Td><NetTag>GH₵{parseFloat(i.netAmount || 0).toFixed(2)}</NetTag></Td>
                  <Td><PlatformTag>{i.platformTag}</PlatformTag></Td>
                  <Td>{i.paymentDate || '-'}</Td>
                  <Td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <ActionBtn onClick={() => openEditIncome(i)}><Edit2 size={16} /></ActionBtn>
                      <ActionBtn onClick={() => setDeleteTarget(i.id)}><Trash2 size={16} /></ActionBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <MobileGrid>
            {paginated.map(i => (
              <MobileCard key={i.id}>
                <MobileRow><span>Client</span><span><strong>{i.clientName || '-'}</strong></span></MobileRow>
                <MobileRow><span>Milestone</span><span>{i.milestoneLabel || '-'}</span></MobileRow>
                <MobileRow><span>Gross</span><span>GH₵{parseFloat(i.amount || 0).toFixed(2)}</span></MobileRow>
                <MobileRow><span>Fee</span><span><FeeTag>-GH₵{parseFloat(i.platformFee || 0).toFixed(2)}</FeeTag></span></MobileRow>
                <MobileRow><span>Net</span><span><NetTag>GH₵{parseFloat(i.netAmount || 0).toFixed(2)}</NetTag></span></MobileRow>
                <MobileRow><span>Platform</span><span><PlatformTag>{i.platformTag}</PlatformTag></span></MobileRow>
                <MobileRow><span>Date</span><span>{i.paymentDate || '-'}</span></MobileRow>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                  <ActionBtn onClick={() => openEditIncome(i)}><Edit2 size={16} /></ActionBtn>
                  <ActionBtn onClick={() => setDeleteTarget(i.id)}><Trash2 size={16} /></ActionBtn>
                </div>
              </MobileCard>
            ))}
            {paginated.length === 0 && <EmptyState>No income entries yet.</EmptyState>}
          </MobileGrid>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
              <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.5rem 1rem', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
            </div>
          )}

          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
            <h2 style={{ marginBottom: '1.5rem', color: '#6F240A' }}>{editId ? 'Edit Income' : 'Add Income'}</h2>
            <form onSubmit={handleSaveIncome}>
              <Label>Client</Label>
              {customers.length > 0 ? (
                <Select value={incomeForm.clientName} onChange={e => setIncomeForm(f => ({ ...f, clientName: e.target.value }))} autoFocus>
                  <option value="">-- Select a customer --</option>
                  {customers.map(c => <option key={c.id} value={c.name}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </Select>
              ) : (
                <Input value={incomeForm.clientName} onChange={e => setIncomeForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" autoFocus />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <Label>Gross Amount (GH₵)</Label>
                  <Input type="number" step="0.01" value={incomeForm.amount} onChange={e => {
                    const v = e.target.value;
                    setIncomeForm(f => ({ ...f, amount: v, netAmount: calcNet(v, f.platformFee) }));
                  }} placeholder="0.00" required />
                </div>
                <div>
                  <Label>Platform Fee (GH₵)</Label>
                  <Input type="number" step="0.01" value={incomeForm.platformFee} onChange={e => {
                    const v = e.target.value;
                    setIncomeForm(f => ({ ...f, platformFee: v, netAmount: calcNet(f.amount, v) }));
                  }} placeholder="0.00" />
                </div>
              </div>
              {incomeForm.netAmount && (
                <FeeCalcBox>
                  Net payout: <strong>GH₵{incomeForm.netAmount}</strong>
                  {parseFloat(incomeForm.platformFee) > 0 && (
                    <span> ({(parseFloat(incomeForm.platformFee) / parseFloat(incomeForm.amount) * 100).toFixed(1)}% in fees)</span>
                  )}
                </FeeCalcBox>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <Label>Platform</Label>
                  <Select value={incomeForm.platformTag} onChange={e => setIncomeForm(f => ({ ...f, platformTag: e.target.value }))}>
                    <option value="direct">Direct Client</option>
                    <option value="upwork">Upwork</option>
                    <option value="fiverr">Fiverr</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="referral">Referral</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <Label>Milestone Label</Label>
                  <Input value={incomeForm.milestoneLabel} onChange={e => setIncomeForm(f => ({ ...f, milestoneLabel: e.target.value }))} placeholder="50% deposit" />
                </div>
              </div>
              <Label>Payment Date</Label>
              <Input type="date" value={incomeForm.paymentDate} onChange={e => setIncomeForm(f => ({ ...f, paymentDate: e.target.value }))} />
              <Label>Notes</Label>
              <Input value={incomeForm.notes} onChange={e => setIncomeForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingIncome} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: savingIncome ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: savingIncome ? 'not-allowed' : 'pointer' }}>{savingIncome ? 'Saving...' : (editId ? 'Update' : 'Add')} Income</button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {tab === 'recurring' && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Amount</Th>
                <Th>Frequency</Th>
                <Th>Next Due</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th style={{ width: 80 }}></Th>
              </tr>
            </thead>
            <tbody>
              {recurring.map(r => (
                <tr key={r.id}>
                  <Td><strong>{r.clientName}</strong></Td>
                  <Td>GH₵{parseFloat(r.amount || 0).toFixed(2)}</Td>
                  <Td style={{ textTransform: 'capitalize' }}>{r.frequency}</Td>
                  <Td>{r.nextDueDate || '-'}</Td>
                  <Td>{r.category || '-'}</Td>
                  <Td><PlatformTag>{r.active !== false ? 'Active' : 'Paused'}</PlatformTag></Td>
                  <Td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <ActionBtn onClick={() => openEditRecur(r)}><Edit2 size={16} /></ActionBtn>
                      <ActionBtn onClick={() => setRecurDeleteTarget(r.id)}><Trash2 size={16} /></ActionBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <MobileGrid>
            {recurring.map(r => (
              <MobileCard key={r.id}>
                <MobileRow><span>Client</span><span><strong>{r.clientName}</strong></span></MobileRow>
                <MobileRow><span>Amount</span><span>GH₵{parseFloat(r.amount || 0).toFixed(2)}</span></MobileRow>
                <MobileRow><span>Frequency</span><span style={{ textTransform: 'capitalize' }}>{r.frequency}</span></MobileRow>
                <MobileRow><span>Next Due</span><span>{r.nextDueDate || '-'}</span></MobileRow>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                  <ActionBtn onClick={() => openEditRecur(r)}><Edit2 size={16} /></ActionBtn>
                  <ActionBtn onClick={() => setRecurDeleteTarget(r.id)}><Trash2 size={16} /></ActionBtn>
                </div>
              </MobileCard>
            ))}
            {recurring.length === 0 && <EmptyState>No recurring income.</EmptyState>}
          </MobileGrid>

          <Modal isOpen={recurModal} onClose={() => setRecurModal(false)}>
            <h2 style={{ marginBottom: '1.5rem', color: '#6F240A' }}>{recurEditId ? 'Edit Recurring Income' : 'Add Recurring Income'}</h2>
            <form onSubmit={handleSaveRecur}>
              <Label>Client *</Label>
              {customers.length > 0 ? (
                <Select required value={recurForm.clientName} onChange={e => setRecurForm(f => ({ ...f, clientName: e.target.value }))} autoFocus>
                  <option value="">-- Select a customer --</option>
                  {customers.map(c => <option key={c.id} value={c.name}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </Select>
              ) : (
                <Input required value={recurForm.clientName} onChange={e => setRecurForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Monthly retainer client" autoFocus />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <Label>Amount (GH₵)</Label>
                  <Input type="number" step="0.01" required value={recurForm.amount} onChange={e => setRecurForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={recurForm.frequency} onChange={e => setRecurForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </div>
              </div>
              <Label>Next Due Date</Label>
              <Input type="date" value={recurForm.nextDueDate} onChange={e => setRecurForm(f => ({ ...f, nextDueDate: e.target.value }))} />
              <Label>Category</Label>
              <Input value={recurForm.category} onChange={e => setRecurForm(f => ({ ...f, category: e.target.value }))} placeholder="Hosting, retainer, maintenance..." />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setRecurModal(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingRecur} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: savingRecur ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: savingRecur ? 'not-allowed' : 'pointer' }}>{savingRecur ? 'Saving...' : (recurEditId ? 'Update' : 'Add')} Recurring</button>
              </div>
            </form>
          </Modal>
        </>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onConfirm={async () => { setDeleting(true); try { await deleteServiceIncome(deleteTarget); setDeleteTarget(null); await load(); } catch (e) { console.error(e); } finally { setDeleting(false); } }} onCancel={() => setDeleteTarget(null)} title="Delete Income" message="Are you sure?" confirmLoading={deleting} />
      <ConfirmDialog isOpen={!!recurDeleteTarget} onConfirm={async () => { setDeleting(true); try { await deleteRecurringIncome(recurDeleteTarget); setRecurDeleteTarget(null); await load(); } catch (e) { console.error(e); } finally { setDeleting(false); } }} onCancel={() => setRecurDeleteTarget(null)} title="Delete Recurring" message="Are you sure?" confirmLoading={deleting} />
    </div>
  );
};

export default IncomeTracking;
