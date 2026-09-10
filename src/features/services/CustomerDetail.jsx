import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, Plus, CheckCircle, Pencil, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { fetchCustomers, fetchServiceIncome, fetchInvoices, fetchCategories, createCategory, createInvoice, createServiceIncome, updateInvoice, updateCustomer, updateServiceIncome } from '../../services/api';
import { sanitizeInput } from '../../utils/sanitize';

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  width: fit-content;

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ProfileCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.4rem;
`;

const ProfileInfo = styled.div`
  flex: 1;
  min-width: 200px;
`;

const Name = styled.h1`
  font-size: 1.35rem;
  margin: 0 0 0.25rem;
  color: ${({ theme }) => theme.colors.text.main};
`;

const Detail = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.85rem;
  margin-top: 0.3rem;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
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

const PaymentBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: #25432F;
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover { filter: brightness(1.2); }
`;

const EditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: white;
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }
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
  border-top: 4px solid ${props => props.$color || props.theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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
    color: ${props => props.$color || props.theme.colors.primary};
  }

  .sub {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.text.muted};
    margin-top: 0.25rem;
  }
`;

const TableCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
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
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: ${props => props.$status === 'Paid' ? 'rgba(37, 67, 47, 0.1)'
    : props.$status === 'Partial' ? 'rgba(135, 82, 0, 0.1)'
    : 'rgba(198, 40, 40, 0.1)'};
  color: ${props => props.$status === 'Paid' ? '#25432F'
    : props.$status === 'Partial' ? '#875200'
    : '#C62828'};
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

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.95rem;
`;

const MobileGrid = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
`;

const MobileCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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

const Select = styled.select`
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.9rem;
  margin-bottom: 1rem;
  background: white;
`;

const PayItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};

  &:last-child { border-bottom: none; }
`;

const PayMeta = styled.div`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: 0.15rem;
`;

const PayBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  background: #25432F;
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover { filter: brightness(1.2); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const PayInput = styled.input`
  width: 110px;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.9rem;
`;

const fmt = (n) => `GH₵${(n || 0).toFixed(2)}`;
const todayISO = () => new Date().toISOString().split('T')[0];
const moneyOf = (v) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [income, setIncome] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editInc, setEditInc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [svcForm, setSvcForm] = useState({ service: '', amount: '', date: todayISO(), category: '' });
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', location: '', notes: '' });
  const [incForm, setIncForm] = useState({ service: '', amount: '', date: todayISO(), category: '' });
  const [payments, setPayments] = useState({});

  const load = async () => {
    const [c, i, inv, cats] = await Promise.all([fetchCustomers(), fetchServiceIncome(), fetchInvoices(), fetchCategories('income')]);
    setCustomers(c);
    setIncome(i);
    setInvoices(inv);
    setCategories(cats);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const openPayments = () => {
    setPayments({});
    setShowPayments(true);
  };

  const openAddService = () => {
    setSvcForm({ service: '', amount: '', date: todayISO(), category: '' });
    setShowNewCat(false);
    setNewCatName('');
    setShowAddService(true);
  };

  const handleCreateNewCat = async () => {
    if (!newCatName.trim()) return;
    setAddingNewCat(true);
    try {
      await createCategory({ name: newCatName.trim(), type: 'income' });
      const cats = await fetchCategories('income');
      setCategories(cats);
      setSvcForm(f => ({ ...f, category: newCatName.trim() }));
      setIncForm(f => ({ ...f, category: newCatName.trim() }));
      setNewCatName('');
      setShowNewCat(false);
    } catch (error) {
      console.error('Failed to create category', error);
      alert('Failed to create category. Please try again.');
    } finally {
      setAddingNewCat(false);
    }
  };

  const customer = customers.find(c => String(c.id) === String(id));

  if (!customer) {
    return (
      <div>
        <BackButton onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</BackButton>
        <EmptyState>Customer not found.</EmptyState>
      </div>
    );
  }

  const name = customer.name;
  const customerIncome = income.filter(i => (i.clientName || '').trim().toLowerCase() === name.trim().toLowerCase());
  const customerInvoices = invoices.filter(inv => (inv.customer || '').trim().toLowerCase() === name.trim().toLowerCase());

  const servicesOf = (inv) => {
    if (!Array.isArray(inv.items) || inv.items.length === 0) return [];
    return inv.items.filter(i => !i.type);
  };
  const serviceNameOf = (inv) => {
    const s = servicesOf(inv)[0];
    return s?.name || `Invoice #${inv.id}`;
  };
  const categoryOf = (inv) => {
    const s = servicesOf(inv)[0];
    return s?.category || '';
  };
  const amountOf = (inv) => moneyOf(inv.amount);

  const paymentsFor = (inv) => customerIncome.filter(i =>
    (i.platformTag === 'invoice' || i.platformTag === 'payment') &&
    new RegExp('invoice #' + String(inv.id) + '(?!\\d)', 'i').test(String(i.notes || ''))
  );

  const paidAmountOf = (inv) => {
    if (inv.status === 'paid') return amountOf(inv);
    const paid = paymentsFor(inv).reduce((s, i) => s + moneyOf(i.netAmount || i.amount), 0);
    return Math.min(paid, amountOf(inv));
  };
  const balanceOf = (inv) => Math.max(0, amountOf(inv) - paidAmountOf(inv));
  const statusOf = (inv) => {
    if (inv.status === 'paid' || balanceOf(inv) <= 0) return 'Paid';
    return paidAmountOf(inv) > 0 ? 'Partial' : 'Unpaid';
  };

  const legacyIncome = customerIncome.filter(i => i.platformTag === 'manual');

  const invoiceRows = customerInvoices.map(inv => ({
    id: `inv-${inv.id}`,
    date: inv.date || '',
    service: serviceNameOf(inv),
    category: categoryOf(inv),
    status: statusOf(inv),
    amount: amountOf(inv),
    balance: balanceOf(inv),
    kind: 'invoice',
    raw: inv,
  }));

  const legacyRows = legacyIncome.map(i => ({
    id: `ic-${i.id}`,
    date: i.paymentDate || '',
    service: i.milestoneLabel || 'Service payment',
    category: i.category || '',
    status: 'Paid',
    amount: moneyOf(i.netAmount || i.amount),
    balance: 0,
    kind: 'income',
    raw: i,
  }));

  const rows = [...invoiceRows, ...legacyRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalReceived = customerIncome.reduce((s, i) => s + moneyOf(i.netAmount || i.amount), 0);
  const totalBilled = customerInvoices.reduce((s, inv) => s + amountOf(inv), 0) + legacyRows.reduce((s, r) => s + r.amount, 0);
  const outstanding = customerInvoices.reduce((s, inv) => s + balanceOf(inv), 0);
  const outstandingInvoices = customerInvoices.filter(inv => balanceOf(inv) > 0);
  const openServices = customerInvoices.length + legacyRows.length;

  const handleAddService = async (e) => {
    e.preventDefault();
    setSaving(true);
    const amount = moneyOf(svcForm.amount);
    try {
      await createInvoice({
        customer: sanitizeInput(name, 100),
        customerLocation: customer.location || '',
        date: svcForm.date || todayISO(),
        quantity: 1,
        unitPrice: amount,
        status: 'pending',
        amount: `GH₵${amount.toFixed(2)}`,
        notes: '',
        items: [{ name: sanitizeInput(svcForm.service, 100), quantity: 1, unitPrice: amount, category: sanitizeInput(svcForm.category, 50) }],
      });
      setShowAddService(false);
      await load();
    } catch (error) {
      console.error('Failed to add service', error);
      alert('Failed to add service. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (inv) => {
    const balance = balanceOf(inv);
    const entry = payments[inv.id] || { amount: String(balance || ''), date: todayISO() };
    let payAmt = moneyOf(entry.amount);
    payAmt = Math.min(payAmt, balance);
    if (payAmt <= 0) {
      alert('Enter an amount to record.');
      return;
    }
    setPayingId(inv.id);
    try {
      await createServiceIncome({
        client_name: sanitizeInput(name, 100),
        amount: payAmt,
        platform_fee: 0,
        net_amount: payAmt,
        platform_tag: 'invoice',
        milestone_label: serviceNameOf(inv),
        category: categoryOf(inv),
        payment_date: entry.date || todayISO(),
        notes: `Payment on invoice #${inv.id}`,
      });
      if (balance - payAmt <= 0) {
        await updateInvoice(inv.id, { status: 'paid' });
      }
      await load();
    } catch (error) {
      console.error('Failed to record payment', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setPayingId(null);
    }
  };

  const openEditCustomer = () => {
    setCustForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      location: customer.location || '',
      notes: customer.notes || '',
    });
    setShowEditCustomer(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await updateCustomer(customer.id, {
        name: sanitizeInput(custForm.name, 100),
        email: sanitizeInput(custForm.email, 100),
        phone: sanitizeInput(custForm.phone, 30),
        location: sanitizeInput(custForm.location, 200),
        notes: sanitizeInput(custForm.notes, 500),
      });
      setShowEditCustomer(false);
      await load();
    } catch (error) {
      console.error('Failed to update customer', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditService = (r) => {
    setShowNewCat(false);
    setNewCatName('');
    if (r.kind === 'income') {
      setIncForm({
        service: r.raw.milestoneLabel || '',
        amount: String(moneyOf(r.raw.netAmount || r.raw.amount) || ''),
        date: r.raw.paymentDate || todayISO(),
        category: r.raw.category || '',
      });
      setEditInc({ kind: 'income', raw: r.raw });
    } else {
      setIncForm({
        service: serviceNameOf(r.raw),
        amount: String(amountOf(r.raw) || ''),
        date: r.raw.date || todayISO(),
        category: categoryOf(r.raw),
      });
      setEditInc({ kind: 'invoice', raw: r.raw });
    }
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!editInc) return;
    setSavingEdit(true);
    const amount = moneyOf(incForm.amount);
    try {
      if (editInc.kind === 'income') {
        await updateServiceIncome(editInc.raw.id, {
          client_name: sanitizeInput(name, 100),
          amount,
          net_amount: amount,
          platform_fee: editInc.raw.platformFee || 0,
          milestone_label: sanitizeInput(incForm.service, 200),
          category: sanitizeInput(incForm.category, 50),
          payment_date: incForm.date || todayISO(),
        });
      } else {
        const paid = paidAmountOf(editInc.raw);
        await updateInvoice(editInc.raw.id, {
          customer: sanitizeInput(name, 100),
          date: incForm.date || todayISO(),
          quantity: 1,
          unitPrice: amount,
          status: paid >= amount ? 'paid' : 'pending',
          amount: `GH₵${amount.toFixed(2)}`,
          items: [{ name: sanitizeInput(incForm.service, 100), quantity: 1, unitPrice: amount, category: sanitizeInput(incForm.category, 50) }],
        });
      }
      setEditInc(null);
      await load();
    } catch (error) {
      console.error('Failed to update service', error);
      alert('Failed to update service. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div>
      <Header>
        <BackButton onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</BackButton>

        <ProfileCard>
          <Avatar>{(name || '?').charAt(0).toUpperCase()}</Avatar>
          <ProfileInfo>
            <Name>{name}</Name>
            {customer.company && (
              <Detail><Building2 size={14} /> {customer.company}</Detail>
            )}
            {customer.email && <Detail><Mail size={14} /> {customer.email}</Detail>}
            {customer.phone && <Detail><Phone size={14} /> {customer.phone}</Detail>}
            {customer.location && <Detail><MapPin size={14} /> {customer.location}</Detail>}
          </ProfileInfo>
        </ProfileCard>

        <ActionRow>
          <PrimaryBtn onClick={openAddService}><Plus size={16} /> Add Service</PrimaryBtn>
          <PaymentBtn onClick={openPayments}><CheckCircle size={16} /> Make Payment</PaymentBtn>
          <EditBtn onClick={openEditCustomer}><Pencil size={14} /> Edit Customer</EditBtn>
        </ActionRow>
      </Header>

      <StatRow>
        <StatCard>
          <h3>Total Billed</h3>
          <div className="value">{fmt(totalBilled)}</div>
          <div className="sub">{openServices} service(s) billed</div>
        </StatCard>
        <StatCard $color="#25432F">
          <h3>Total Received</h3>
          <div className="value">{fmt(totalReceived)}</div>
          <div className="sub">{customerIncome.length} payment(s)</div>
        </StatCard>
        <StatCard $color="#C62828">
          <h3>Outstanding Balance</h3>
          <div className="value">{fmt(outstanding)}</div>
          <div className="sub">{outstandingInvoices.length} unpaid service(s)</div>
        </StatCard>
      </StatRow>

      <TableCard>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Service</Th>
              <Th>Status</Th>
              <Th style={{ textAlign: 'right' }}>Amount</Th>
              <Th style={{ textAlign: 'right' }}>Balance</Th>
              <Th style={{ width: 60 }}></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <Td>{r.date || '-'}</Td>
                <Td>{r.service}{r.category ? <div style={{ fontSize: '0.75rem', color: '#875200', fontWeight: 600 }}>{r.category}</div> : null}</Td>
                <Td><StatusBadge $status={r.status}>{r.status}</StatusBadge></Td>
                <Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.amount)}</Td>
                <Td style={{ textAlign: 'right', fontWeight: 700, color: r.balance > 0 ? '#C62828' : '#25432F' }}>{fmt(r.balance)}</Td>
                <Td>
                  <ActionBtn onClick={() => openEditService(r)} title="Edit service" aria-label={`Edit ${r.service}`}><Pencil size={15} /></ActionBtn>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <MobileGrid>
          {rows.map(r => (
            <MobileCard key={r.id}>
              <MobileRow><span>Date</span><span>{r.date || '-'}</span></MobileRow>
              <MobileRow><span>Service</span><span><strong>{r.service}</strong></span></MobileRow>
              {r.category && <MobileRow><span>Category</span><span style={{ color: '#875200', fontWeight: 700 }}>{r.category}</span></MobileRow>}
              <MobileRow><span>Status</span><span><StatusBadge $status={r.status}>{r.status}</StatusBadge></span></MobileRow>
              <MobileRow><span>Amount</span><span><strong>{fmt(r.amount)}</strong></span></MobileRow>
              <MobileRow><span>Balance</span><span style={{ fontWeight: 700, color: r.balance > 0 ? '#C62828' : '#25432F' }}>{fmt(r.balance)}</span></MobileRow>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <ActionBtn onClick={() => openEditService(r)} title="Edit service" aria-label={`Edit ${r.service}`}><Pencil size={15} /></ActionBtn>
              </div>
            </MobileCard>
          ))}
          {rows.length === 0 && <EmptyState>No services recorded for this customer yet.</EmptyState>}
        </MobileGrid>
      </TableCard>

      {rows.length === 0 && (
        <EmptyState>No services recorded for this customer yet. Use <strong>Add Service</strong> to bill them.</EmptyState>
      )}

      <Modal isOpen={showAddService} onClose={() => setShowAddService(false)} title={`Add Service for ${name}`}>
        <form onSubmit={handleAddService}>
          <Label>Service *</Label>
          <Input required value={svcForm.service} onChange={e => setSvcForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Website design, Consultation" autoFocus />
          <Label>Category</Label>
          <Select value={showNewCat ? '__new__' : svcForm.category} onChange={e => {
            const v = e.target.value;
            setShowNewCat(v === '__new__');
            if (v !== '__new__') setSvcForm(f => ({ ...f, category: v }));
          }}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="__new__">＋ Add new category...</option>
          </Select>
          {showNewCat && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New income category" onKeyDown={e => { if (e.key === 'Enter') handleCreateNewCat(); }} />
              <button type="button" onClick={handleCreateNewCat} disabled={addingNewCat || !newCatName.trim()} style={{ padding: '0.6rem 1rem', border: 'none', borderRadius: 8, background: addingNewCat || !newCatName.trim() ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{addingNewCat ? 'Adding...' : 'Add'}</button>
            </div>
          )}
          <Label>Amount (GH₵) *</Label>
          <Input required type="number" min="0" step="0.01" value={svcForm.amount} onChange={e => setSvcForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          <Label>Service Date *</Label>
          <Input required type="date" value={svcForm.date} onChange={e => setSvcForm(f => ({ ...f, date: e.target.value }))} />
          <p style={{ fontSize: '0.85rem', color: '#55423D', margin: '-0.25rem 0 0.5rem' }}>
            This service is billed as <strong>unpaid</strong>. Use <strong>Make Payment</strong> to record deposits or the balance later.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setShowAddService(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: '#6F240A', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Adding...' : 'Add Service'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPayments} onClose={() => setShowPayments(false)} title={`Make Payment — ${name}`}>
        {outstandingInvoices.length === 0 ? (
          <EmptyState>No outstanding balances for this customer. All settled!</EmptyState>
        ) : (
          <>
            <p style={{ fontSize: '0.9rem', color: '#55423D', marginBottom: '0.5rem' }}>
              Customers don't always pay in full. Enter a <strong>full payment</strong> or a <strong>deposit</strong> — the balance is tracked automatically.
            </p>
            {outstandingInvoices.map(inv => {
              const balance = balanceOf(inv);
              const entry = payments[inv.id] || { amount: String(balance || ''), date: todayISO() };
              return (
                <PayItem key={inv.id}>
                  <div style={{ flex: 1 }}>
                    <strong>{serviceNameOf(inv)}</strong>
                    <PayMeta>Invoice {inv.id} • Billed {fmt(amountOf(inv))} • Due {inv.date || '-'}</PayMeta>
                    <PayMeta>Remaining balance: <strong style={{ color: '#C62828' }}>{fmt(balance)}</strong></PayMeta>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <PayInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.amount}
                      onChange={e => setPayments(p => ({ ...p, [inv.id]: { ...(p[inv.id] || { date: todayISO() }), amount: e.target.value } }))}
                      placeholder="Amount"
                    />
                    <PayInput
                      type="date"
                      value={entry.date}
                      onChange={e => setPayments(p => ({ ...p, [inv.id]: { ...(p[inv.id] || { amount: String(balance || '') }), date: e.target.value } }))}
                      style={{ width: 130 }}
                    />
                    <PayBtn onClick={() => handleRecordPayment(inv)} disabled={payingId === inv.id}>
                      <CheckCircle size={14} /> {payingId === inv.id ? 'Recording...' : 'Record'}
                    </PayBtn>
                  </div>
                </PayItem>
              );
            })}
          </>
        )}
      </Modal>

      <Modal isOpen={showEditCustomer} onClose={() => setShowEditCustomer(false)} title={`Edit Customer — ${name}`}>
        <form onSubmit={handleSaveCustomer}>
          <Label>Full Name *</Label>
          <Input required value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" autoFocus />
          <Label>Email</Label>
          <Input type="email" value={custForm.email} onChange={e => setCustForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          <Label>Phone</Label>
          <Input value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233 XX XXX XXXX" />
          <Label>Location</Label>
          <Input value={custForm.location} onChange={e => setCustForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Region" />
          <Label>Notes</Label>
          <Input value={custForm.notes} onChange={e => setCustForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setShowEditCustomer(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingEdit} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: '#6F240A', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editInc} onClose={() => setEditInc(null)} title="Edit Service">
        <form onSubmit={handleSaveService}>
          <Label>Service *</Label>
          <Input required value={incForm.service} onChange={e => setIncForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Website design, Consultation" autoFocus />
          <Label>Category</Label>
          <Select value={showNewCat ? '__new__' : incForm.category} onChange={e => {
            const v = e.target.value;
            setShowNewCat(v === '__new__');
            if (v !== '__new__') setIncForm(f => ({ ...f, category: v }));
          }}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="__new__">＋ Add new category...</option>
          </Select>
          {showNewCat && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New income category" onKeyDown={e => { if (e.key === 'Enter') handleCreateNewCat(); }} />
              <button type="button" onClick={handleCreateNewCat} disabled={addingNewCat || !newCatName.trim()} style={{ padding: '0.6rem 1rem', border: 'none', borderRadius: 8, background: addingNewCat || !newCatName.trim() ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{addingNewCat ? 'Adding...' : 'Add'}</button>
            </div>
          )}
          <Label>Amount (GH₵) *</Label>
          <Input required type="number" min="0" step="0.01" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          <Label>{editInc?.kind === 'invoice' ? 'Service Date *' : 'Payment Date *'}</Label>
          <Input required type="date" value={incForm.date} onChange={e => setIncForm(f => ({ ...f, date: e.target.value }))} />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setEditInc(null)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={savingEdit} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: '#6F240A', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerDetail;