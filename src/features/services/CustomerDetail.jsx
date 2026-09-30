import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, Plus, CheckCircle, Pencil, Trash2, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchCustomers, fetchServiceIncome, fetchInvoices, fetchCategories, createCategory, createInvoice, createServiceIncome, updateInvoice, updateCustomer, updateServiceIncome, deleteServiceIncome, deleteInvoice, fetchServices } from '../../services/api';
import { sanitizeInput } from '../../utils/sanitize';
import { useSettingsStore } from '../../store/settingsStore';
import CatalogPicker from './CatalogPicker';
import SizePricingCalculator from './SizePricingCalculator';
import { freshSizeLine, numOf, solveSizeLines, round2, roundUp, SQFT_DIVISOR } from './sizePricing';

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
    font-weight: 600;
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

const TabBar = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  font-weight: 700;
  font-size: 0.9rem;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.text.muted};
  border-bottom: 2px solid ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { color: ${({ theme }) => theme.colors.primary}; }
`;

const TabCount = styled.span`
  background: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.outlineVariant};
  color: ${props => props.$active ? 'white' : props.theme.colors.text.muted};
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
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

const SegBox = styled.div`
  display: flex;
  background: #F5F3F0;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 1rem;
`;

const SegBtn = styled.button`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: ${props => props.$active ? '#6F240A' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: ${props => props.$active ? '#6F240A' : '#ECE7E2'};
    color: ${props => props.$active ? 'white' : '#6F240A'};
  }
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

const PaySelect = styled.select`
  width: 120px;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: 0.9rem;
  background: white;
`;

const MethodBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.primarySoft || '#F3E9E4'};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
`;

const fmt = (n) => `GH₵${(n || 0).toFixed(2)}`;
const todayISO = () => new Date().toISOString().split('T')[0];
const moneyOf = (v) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const [customers, setCustomers] = useState([]);
  const [income, setIncome] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [priceMode, setPriceMode] = useState('flat');
  const [calcLines, setCalcLines] = useState([freshSizeLine()]);
  const [showPayments, setShowPayments] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editInc, setEditInc] = useState(null);
  const [viewTab, setViewTab] = useState('services');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [svcForm, setSvcForm] = useState({ service: '', amount: '', quantity: 1, date: todayISO(), category: '', status: 'unpaid', method: 'cash', areaPrice: '' });
  const [custForm, setCustForm] = useState({ name: '', email: '', phone: '', location: '', notes: '' });
  const [incForm, setIncForm] = useState({ service: '', amount: '', date: todayISO(), category: '', status: 'unpaid', method: 'cash' });
  const [editSizeMode, setEditSizeMode] = useState(false);
  const [editSizeLines, setEditSizeLines] = useState([freshSizeLine()]);
  const [editSizeRate, setEditSizeRate] = useState(0);
  const [editItems, setEditItems] = useState([{ name: '', quantity: '1', unitPrice: '' }]);
  const [payments, setPayments] = useState({});

  const load = async () => {
    const [c, i, inv, cats, svcs] = await Promise.all([fetchCustomers(), fetchServiceIncome(), fetchInvoices(), fetchCategories('income'), fetchServices()]);
    setCustomers(c);
    setIncome(i);
    setInvoices(inv);
    setCategories(cats);
    setServices(svcs);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const openPayments = () => {
    setPayments({});
    setShowPayments(true);
  };

  const openAddService = () => {
    setSvcForm({ service: '', amount: '', quantity: 1, date: todayISO(), category: '', status: 'unpaid', method: 'cash', areaPrice: '' });
    setPriceMode('flat');
    setCalcLines([freshSizeLine()]);
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

  const matchInvoiceId = (notes) => {
    const m = String(notes || '').match(/invoice #(\d+)/i);
    return m ? m[1] : null;
  };

  const methodOf = (notes) => {
    const m = String(notes || '').match(/\[(cash|momo|bank)\]\s*$/i);
    return m ? m[1].toLowerCase() : '';
  };

  const methodLabelOf = (notes) => {
    const m = methodOf(notes);
    return m === 'momo' ? 'Mobile Money' : m ? m[0].toUpperCase() + m.slice(1) : '';
  };

  const withMethod = (notes, method) => {
    const base = String(notes || '').replace(/\[(cash|momo|bank)\]\s*$/i, '').trim();
    return method ? `${base} [${method}]` : base;
  };

  const reconcileInvoiceStatus = async (invId) => {
    const inv = invoices.find(x => String(x.id) === String(invId));
    if (!inv) return;
    const refs = customerIncome.filter(p =>
      new RegExp('invoice #' + String(invId) + '(?!\\d)', 'i').test(String(p.notes || ''))
    );
    const sum = refs.reduce((s, p) => s + moneyOf(p.netAmount || p.amount), 0);
    if (sum > 0) {
      await updateInvoice(invId, { status: sum >= amountOf(inv) ? 'paid' : 'pending' });
    } else {
      await updateInvoice(invId, { status: 'pending' });
    }
  };

  const legacyIncome = customerIncome.filter(i => i.platformTag === 'manual');

  const invoiceRows = customerInvoices.map(inv => ({
    id: `inv-${inv.id}`,
    date: inv.date || '',
    service: serviceNameOf(inv),
    lines: servicesOf(inv),
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

  const rows = [...invoiceRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const paymentRows = [...customerIncome]
    .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
    .map(i => ({
      id: `pay-${i.id}`,
      date: i.paymentDate || '',
      service: i.milestoneLabel || 'Service payment',
      category: i.category || '',
      method: methodLabelOf(i.notes) || '—',
      amount: moneyOf(i.netAmount || i.amount),
      kind: 'payment',
      raw: i,
    }));

  const totalReceived = customerIncome.reduce((s, i) => s + moneyOf(i.netAmount || i.amount), 0);
  const totalBilled = customerInvoices.reduce((s, inv) => s + amountOf(inv), 0) + legacyRows.reduce((s, r) => s + r.amount, 0);
  const outstanding = customerInvoices.reduce((s, inv) => s + balanceOf(inv), 0);
  const outstandingInvoices = customerInvoices.filter(inv => balanceOf(inv) > 0);
  const openServices = customerInvoices.length;

  const areaConfig = () => {
    const pRaw = svcForm.areaPrice !== undefined && svcForm.areaPrice !== '' ? svcForm.areaPrice : (settings.areaPrice || '0');
    return { P: Math.max(0, moneyOf(pRaw)) };
  };

  const solveCalcLines = () => solveSizeLines(calcLines, areaConfig().P);

  const printQuote = () => {
    const { P } = areaConfig();
    const rows = solveCalcLines()
      .filter(s => s.valid)
      .map(s => {
        const formula = s.unit === 'feet'
          ? `(L×H)×P×Q = (${s.L.toFixed(2)}×${s.H.toFixed(2)})×${P.toFixed(2)}×${s.Q}`
          : `(L×H÷${SQFT_DIVISOR})×P×Q = (${s.L.toFixed(2)}×${s.H.toFixed(2)}÷${SQFT_DIVISOR})×${P.toFixed(2)}×${s.Q}`;
        return `
        <tr>
          <td>${esc(s.label || svcForm.service || 'Item')}</td>
          <td>${s.L.toFixed(2)} × ${s.H.toFixed(2)} ${s.unit === 'feet' ? 'ft' : s.unit === 'inches' ? 'in' : 'cm'}</td>
          <td>${P.toFixed(2)}</td>
          <td><b>${s.itemPrice.toFixed(2)}</b></td>
          <td>${s.Q}</td>
          <td><b>${s.total.toFixed(2)}</b></td>
          <td class="muted">${formula}</td>
        </tr>`;
      })
      .join('');
    const grand = roundUp(solveCalcLines().filter(s => s.valid).reduce((sum, s) => sum + s.total, 0));
    const w = window.open('', '_blank', 'width=780,height=920');
    if (!w) return;
    w.document.write(`<!doctype html>
      <html>
        <head><meta charset="utf-8" /><title>Price Quote</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1C1C18; margin: 40px; }
          .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6F240A; padding-bottom: 12px; margin-bottom: 16px; }
          .brand { font-size: 20px; font-weight: 800; color: #6F240A; }
          .sub { font-size: 13px; color: #55423D; }
          .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F0EEE8; font-size: 14px; }
          .kv b { color: #1C1C18; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
          th { text-align: left; background: #F5F3F0; padding: 8px; }
          td { padding: 8px; border-bottom: 1px solid #F0EEE8; }
          .muted { color: #89726C; font-size: 11px; }
          .total { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 12px 16px; background: #25432F; color: #fff; border-radius: 10px; font-size: 18px; font-weight: 800; }
          .foot { text-align: center; margin-top: 28px; font-size: 12px; color: #89726C; }
        </style></head>
        <body>
          <div class="hdr">
            <div><div class="brand">${esc(settings.businessName || 'KaisySales')}</div><div class="sub">Price Quote</div></div>
            <div class="sub">${new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div class="kv"><span>Client</span><b>${esc(name)}</b></div>
          <div class="kv"><span>Service</span><b>${esc(svcForm.service || '—')}</b></div>
          <table>
            <tr><th>Item</th><th>Size</th><th>Rate/sq ft</th><th>Sq Ft Price</th><th>Qty</th><th>Total</th><th>Formula</th></tr>
            ${rows || '<tr><td colspan="7">No items</td></tr>'}
          </table>
          <div class="total"><span>Grand Total</span><span>GH₵${grand.toLocaleString()}</span></div>
          <p class="foot">KaisySales - Know your Business, Stay in Control</p>
        </body>
      </html>`);
    w.document.close();
    w.print();
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    setSaving(true);
    const sizeItems = solveCalcLines().filter(s => s.valid);
    const usingSize = priceMode === 'size' && sizeItems.length > 0;
    const unitPrice = moneyOf(svcForm.amount);
    const qty = Math.max(1, parseInt(svcForm.quantity) || 1);
    const items = usingSize
      ? sizeItems.map(it => ({
          name: sanitizeInput(it.label || svcForm.service, 100),
          quantity: it.Q,
          unitPrice: round2(it.itemPrice),
          category: sanitizeInput(svcForm.category, 50),
          size: { unit: it.unit, length: round2(it.L), height: round2(it.H), rate: round2(it.P) }
        }))
      : [{ name: sanitizeInput(svcForm.service, 100), quantity: qty, unitPrice: unitPrice, category: sanitizeInput(svcForm.category, 50) }];
    const lineSum = () => items.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
    const total = usingSize ? roundUp(lineSum()) : (unitPrice * qty);
    if (usingSize && items.length > 0) {
      const last = items[items.length - 1];
      last.unitPrice = Math.max(0, round2(last.unitPrice + (total - lineSum()) / last.quantity));
    }
    const totalQty = usingSize ? items.reduce((s, it) => s + it.quantity, 0) : qty;
    const isPaid = svcForm.status === 'paid';
    try {
      const created = await createInvoice({
        customer: sanitizeInput(name, 100),
        customerLocation: customer.location || '',
        date: svcForm.date || todayISO(),
        quantity: totalQty,
        unitPrice: totalQty > 0 ? +(total / totalQty) : unitPrice,
        status: isPaid ? 'paid' : 'pending',
        amount: `GH₵${total.toFixed(2)}`,
        notes: '',
        items,
      });
      if (isPaid && created?.id) {
        await createServiceIncome({
          client_name: sanitizeInput(name, 100),
          amount: total,
          platform_fee: 0,
          net_amount: total,
          platform_tag: 'invoice',
          milestone_label: sanitizeInput(svcForm.service, 200),
          category: sanitizeInput(svcForm.category, 50),
          payment_date: svcForm.date || todayISO(),
          notes: withMethod(`Payment on invoice #${created.id}`, svcForm.method),
        });
      }
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
        notes: withMethod(`Payment on invoice #${inv.id}`, entry.method || 'cash'),
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
    if (r.kind === 'payment' || r.kind === 'income') {
      setIncForm({
        service: r.raw.milestoneLabel || '',
        amount: String(moneyOf(r.raw.netAmount || r.raw.amount) || ''),
        date: r.raw.paymentDate || todayISO(),
        category: r.raw.category || '',
        status: 'paid',
        method: methodOf(r.raw.notes) || 'cash',
      });
      setEditInc({ kind: r.kind, raw: r.raw });
      setEditSizeMode(false);
      setEditSizeLines([freshSizeLine()]);
      setEditSizeRate(0);
      setEditItems([{ name: '', quantity: '1', unitPrice: '' }]);
    } else {
      const rawItems = Array.isArray(r.raw.items) ? r.raw.items : [];
      const lines = rawItems.filter(i => !i.type);
      const sized = lines.filter(i => i.size);
      setEditItems(
        lines.length > 0
          ? lines.map(i => ({ name: i.name || '', quantity: String(parseInt(i.quantity) || 1), unitPrice: String(numOf(i.unitPrice)) }))
          : [{ name: serviceNameOf(r.raw), quantity: String(parseInt(r.raw.quantity) || 1), unitPrice: String(amountOf(r.raw)) }]
      );
      if (sized.length > 0) {
        setEditSizeLines(sized.map(i => ({
          key: `ed-${i.size.unit || 'feet'}-${i.size.length}-${i.size.height}-${i.quantity || 1}-${i.name || ''}`,
          label: i.name || '',
          unit: i.size.unit || 'feet',
          length: String(i.size.length ?? ''),
          height: String(i.size.height ?? ''),
          quantity: parseInt(i.quantity) || 1,
        })));
        setEditSizeRate(sized[0].size.rate ?? settings.areaPrice ?? 0);
        setEditSizeMode(true);
      } else {
        setEditSizeMode(false);
        setEditSizeLines([freshSizeLine()]);
        setEditSizeRate(0);
      }
      setIncForm({
        service: serviceNameOf(r.raw),
        amount: String(amountOf(r.raw) || ''),
        date: r.raw.date || todayISO(),
        category: categoryOf(r.raw),
        status: r.raw.status === 'paid' ? 'paid' : 'unpaid',
      });
      setEditInc({ kind: 'invoice', raw: r.raw });
    }
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!editInc) return;
    if (editInc.kind === 'invoice' && editSizeMode && solveSizeLines(editSizeLines, editSizeRate).filter(s => s.valid).length === 0) {
      alert('Enter a length and height for at least one item, or switch back to flat price.');
      return;
    }
    setSavingEdit(true);
    const amount = moneyOf(incForm.amount);
    try {
      if (editInc.kind === 'income' || editInc.kind === 'payment') {
        await updateServiceIncome(editInc.raw.id, {
          client_name: sanitizeInput(name, 100),
          amount,
          net_amount: amount,
          platform_fee: editInc.raw.platformFee || 0,
          milestone_label: sanitizeInput(incForm.service, 200),
          category: sanitizeInput(incForm.category, 50),
          payment_date: incForm.date || todayISO(),
          notes: withMethod(editInc.raw.notes, incForm.method),
        });
        const refId = matchInvoiceId(editInc.raw.notes);
        if (refId) await reconcileInvoiceStatus(refId);
      } else {
        const paid = paidAmountOf(editInc.raw);
        const targetPaid = incForm.status === 'paid';
        const rawItems = Array.isArray(editInc.raw.items) ? editInc.raw.items : [];
        const markers = rawItems.filter(i => i.type === '_saleId' || i.type === '_incomeId');
        const metaItem = rawItems.find(i => i.type === '_meta');

        let items;
        let finalAmount = amount;
        if (editSizeMode) {
          const valid = solveSizeLines(editSizeLines, editSizeRate).filter(s => s.valid);
          const exact = valid.reduce((s, l) => s + l.total, 0);
          finalAmount = roundUp(exact);
          const built = valid.map(l => ({
            name: sanitizeInput(l.label || 'Item', 100),
            quantity: l.Q,
            unitPrice: round2(l.itemPrice),
            size: { unit: l.unit, length: l.L, height: l.H, rate: round2(editSizeRate) },
          }));
          if (built.length > 0) {
            const lineSum = built.reduce((s, i) => s + round2(i.unitPrice * i.quantity), 0);
            const last = built[built.length - 1];
            last.unitPrice = round2(last.unitPrice + (finalAmount - lineSum) / last.quantity);
          }
          items = built;
        } else {
          items = editItems
            .filter(i => i.name.trim())
            .map(i => ({
              name: sanitizeInput(i.name, 100),
              quantity: Math.max(1, parseInt(i.quantity) || 1),
              unitPrice: round2(numOf(i.unitPrice)),
              category: sanitizeInput(incForm.category, 50),
            }));
          finalAmount = round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
        }
        const discPct = numOf(metaItem?.discount);
        if (discPct > 0) finalAmount = round2(finalAmount * (1 - discPct / 100));
        const itemTotal = items.reduce((s, i) => s + round2((parseInt(i.quantity) || 1) * numOf(i.unitPrice)), 0);

        await updateInvoice(editInc.raw.id, {
          customer: sanitizeInput(name, 100),
          date: incForm.date || todayISO(),
          quantity: items.length,
          unitPrice: items.length ? round2(itemTotal / items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0)) : 0,
          status: targetPaid ? 'paid' : 'pending',
          amount: `GH₵${finalAmount.toFixed(2)}`,
          items: [...(metaItem ? [metaItem] : []), ...items, ...markers],
        });
        if (targetPaid) {
          const gap = finalAmount - paid;
          if (gap > 0) {
            await createServiceIncome({
              client_name: sanitizeInput(name, 100),
              amount: gap,
              platform_fee: 0,
              net_amount: gap,
              platform_tag: 'invoice',
              milestone_label: sanitizeInput(items[0]?.name || incForm.service, 200),
              category: sanitizeInput(incForm.category, 50),
              payment_date: incForm.date || todayISO(),
              notes: withMethod(`Payment on invoice #${editInc.raw.id}`, incForm.method || 'cash'),
            });
          }
        } else {
          const toDelete = paymentsFor(editInc.raw);
          for (const p of toDelete) {
            await deleteServiceIncome(p.id);
          }
        }
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

  const handleDeleteService = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'invoice') {
        const toDelete = paymentsFor(deleteTarget.raw);
        for (const p of toDelete) {
          await deleteServiceIncome(p.id);
        }
        await deleteInvoice(deleteTarget.raw.id);
      } else {
        await deleteServiceIncome(deleteTarget.raw.id);
        const refId = matchInvoiceId(deleteTarget.raw.notes);
        if (refId) await reconcileInvoiceStatus(refId);
      }
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Failed to delete service', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const { P: areaP } = areaConfig();
  const sizeCount = solveCalcLines().filter(s => s.valid).length;
  const editSizeValid = solveSizeLines(editSizeLines, editSizeRate).filter(s => s.valid).length;

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

      <TabBar>
        <Tab $active={viewTab === 'services'} onClick={() => setViewTab('services')}>
          Services <TabCount $active={viewTab === 'services'}>{rows.length}</TabCount>
        </Tab>
        <Tab $active={viewTab === 'payments'} onClick={() => setViewTab('payments')}>
          Payments <TabCount $active={viewTab === 'payments'}>{paymentRows.length}</TabCount>
        </Tab>
      </TabBar>

      {viewTab === 'services' ? (
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
                <Td>
                  {r.service}
                  {r.lines && r.lines.length > 1 && (
                    <div style={{ fontSize: '0.75rem', color: '#89726C' }}>+{r.lines.length - 1} more item{r.lines.length - 1 > 1 ? 's' : ''}</div>
                  )}
                  {r.category ? <div style={{ fontSize: '0.75rem', color: '#875200', fontWeight: 600 }}>{r.category}</div> : null}
                </Td>
                <Td><StatusBadge $status={r.status}>{r.status}</StatusBadge></Td>
                <Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.amount)}</Td>
                <Td style={{ textAlign: 'right', fontWeight: 700, color: r.balance > 0 ? '#C62828' : '#25432F' }}>{fmt(r.balance)}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <ActionBtn onClick={() => openEditService(r)} title="Edit service" aria-label={`Edit ${r.service}`}><Pencil size={15} /></ActionBtn>
                    <ActionBtn onClick={() => setDeleteTarget(r)} title="Delete" aria-label={`Delete ${r.service}`} style={{ color: '#C62828' }}><Trash2 size={15} /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <MobileGrid>
          {rows.map(r => (
            <MobileCard key={r.id}>
              <MobileRow><span>Date</span><span>{r.date || '-'}</span></MobileRow>
              <MobileRow><span>Service</span><span><strong>{r.service}</strong>{r.lines && r.lines.length > 1 ? <span style={{ display: 'block', fontSize: '0.75rem', color: '#89726C' }}>+{r.lines.length - 1} more item{r.lines.length - 1 > 1 ? 's' : ''}</span> : null}</span></MobileRow>
              {r.category && <MobileRow><span>Category</span><span style={{ color: '#875200', fontWeight: 700 }}>{r.category}</span></MobileRow>}
              <MobileRow><span>Status</span><span><StatusBadge $status={r.status}>{r.status}</StatusBadge></span></MobileRow>
              <MobileRow><span>Amount</span><span><strong>{fmt(r.amount)}</strong></span></MobileRow>
              <MobileRow><span>Balance</span><span style={{ fontWeight: 700, color: r.balance > 0 ? '#C62828' : '#25432F' }}>{fmt(r.balance)}</span></MobileRow>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <ActionBtn onClick={() => openEditService(r)} title="Edit service" aria-label={`Edit ${r.service}`}><Pencil size={15} /></ActionBtn>
                <ActionBtn onClick={() => setDeleteTarget(r)} title="Delete" aria-label={`Delete ${r.service}`} style={{ color: '#C62828' }}><Trash2 size={15} /></ActionBtn>
              </div>
            </MobileCard>
          ))}
          {rows.length === 0 && <EmptyState>No services recorded for this customer yet.</EmptyState>}
        </MobileGrid>
      </TableCard>
      ) : (
      <TableCard>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Service</Th>
              <Th>Category</Th>
              <Th>Method</Th>
              <Th style={{ textAlign: 'right' }}>Amount</Th>
              <Th style={{ width: 60 }}></Th>
            </tr>
          </thead>
          <tbody>
            {paymentRows.map(p => (
              <tr key={p.id}>
                <Td>{p.date || '-'}</Td>
                <Td>{p.service}</Td>
                <Td>{p.category || '-'}</Td>
                <Td>{p.method === '—' ? '—' : <MethodBadge>{p.method}</MethodBadge>}</Td>
                <Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.amount)}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <ActionBtn onClick={() => openEditService(p)} title="Edit payment" aria-label={`Edit ${p.service}`}><Pencil size={15} /></ActionBtn>
                    <ActionBtn onClick={() => setDeleteTarget(p)} title="Delete" aria-label={`Delete ${p.service}`} style={{ color: '#C62828' }}><Trash2 size={15} /></ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
            {paymentRows.length === 0 && (
              <tr><Td colSpan={6}><EmptyState>No payments recorded yet. Use <strong>Make Payment</strong> to receive money.</EmptyState></Td></tr>
            )}
          </tbody>
        </Table>

        <MobileGrid>
          {paymentRows.map(p => (
            <MobileCard key={p.id}>
              <MobileRow><span>Date</span><span>{p.date || '-'}</span></MobileRow>
              <MobileRow><span>Service</span><span><strong>{p.service}</strong></span></MobileRow>
              <MobileRow><span>Category</span><span>{p.category || '-'}</span></MobileRow>
              <MobileRow><span>Method</span><span>{p.method === '—' ? '—' : <MethodBadge>{p.method}</MethodBadge>}</span></MobileRow>
              <MobileRow><span>Amount</span><span><strong>{fmt(p.amount)}</strong></span></MobileRow>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <ActionBtn onClick={() => openEditService(p)} title="Edit payment" aria-label={`Edit ${p.service}`}><Pencil size={15} /></ActionBtn>
                <ActionBtn onClick={() => setDeleteTarget(p)} title="Delete" aria-label={`Delete ${p.service}`} style={{ color: '#C62828' }}><Trash2 size={15} /></ActionBtn>
              </div>
            </MobileCard>
          ))}
          {paymentRows.length === 0 && <EmptyState>No payments recorded yet.</EmptyState>}
        </MobileGrid>
      </TableCard>
      )}

      <Modal isOpen={showAddService} onClose={() => setShowAddService(false)} title={`Add Service for ${name}`}>
        <form onSubmit={handleAddService}>
          {services.length > 0 && (
            <CatalogPicker services={services} onPick={s => {
              setSvcForm(f => ({ ...f, service: s.name || '', amount: String(s.price || ''), quantity: 1, category: s.category || '', areaPrice: s.areaPrice ?? '' }));
              if (moneyOf(s.areaPrice) > 0) setPriceMode('size');
              setShowNewCat(false);
            }} />
          )}
          <Label>Service *</Label>
          <Input required value={svcForm.service} onChange={e => setSvcForm(f => ({ ...f, service: e.target.value, areaPrice: '' }))} placeholder="e.g. Website design, Consultation" autoFocus />
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
          <Label>Status</Label>
          <Select value={svcForm.status} onChange={e => setSvcForm(f => ({ ...f, status: e.target.value }))}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </Select>
          {svcForm.status === 'paid' && (
            <>
              <Label>Payment Method</Label>
              <Select value={svcForm.method} onChange={e => setSvcForm(f => ({ ...f, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="momo">Mobile Money</option>
                <option value="bank">Bank Transfer</option>
              </Select>
            </>
          )}
          <Label>Pricing</Label>
          <SegBox>
            <SegBtn type="button" $active={priceMode === 'flat'} onClick={() => setPriceMode('flat')}>Flat Price</SegBtn>
            <SegBtn type="button" $active={priceMode === 'size'} onClick={() => setPriceMode('size')}>By Size</SegBtn>
          </SegBox>

          {priceMode === 'flat' ? (
            <>
              <Label>Unit Price (GH₵) *</Label>
              <Input required type="number" min="0" step="0.01" value={svcForm.amount} onChange={e => setSvcForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              <Label>Quantity *</Label>
              <Input required type="number" min="1" step="1" value={svcForm.quantity} onChange={e => setSvcForm(f => ({ ...f, quantity: e.target.value }))} placeholder="1" />
              <p style={{ fontSize: '0.9rem', color: '#25432F', fontWeight: 700, marginTop: '-0.25rem' }}>
                Total: GH₵{((moneyOf(svcForm.amount) || 0) * Math.max(1, parseInt(svcForm.quantity) || 1)).toFixed(2)}
              </p>
              {areaP > 0 && svcForm.service && (
                <p style={{ fontSize: '0.8rem', color: '#89726C', marginTop: '-0.25rem' }}>
                  "{svcForm.service}" is GH₵{areaP.toFixed(2)} per sq ft — switch to <strong>By Size</strong> to price by dimensions.
                </p>
              )}
            </>
          ) : (
            <SizePricingCalculator lines={calcLines} onChange={setCalcLines} pricePerSqFt={areaP} onPrint={printQuote} emptyRateHint="Set this service's price per sq ft in Service Catalog, or the account default, to price by size." />
          )}
          <Label>Service Date *</Label>
          <Input required type="date" value={svcForm.date} onChange={e => setSvcForm(f => ({ ...f, date: e.target.value }))} />
          <p style={{ fontSize: '0.85rem', color: '#55423D', margin: '-0.25rem 0 0.5rem' }}>
            {svcForm.status === 'unpaid'
              ? <>This service is billed as <strong>unpaid</strong>. Use <strong>Make Payment</strong> to record deposits or the balance later.</>
              : <>This service is marked <strong>paid</strong> — the full amount is added to <strong>Total Received</strong> immediately.</>}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setShowAddService(false)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || (priceMode === 'size' && sizeCount === 0)} style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: saving || (priceMode === 'size' && sizeCount === 0) ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: saving || (priceMode === 'size' && sizeCount === 0) ? 'not-allowed' : 'pointer' }}>
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
const entry = payments[inv.id] || { amount: String(balance || ''), date: todayISO(), method: 'cash' };
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
                      onChange={e => setPayments(p => ({ ...p, [inv.id]: { ...(p[inv.id] || { amount: String(balance || ''), method: 'cash' }), date: e.target.value } }))}
                      style={{ width: 130 }}
                    />
                    <PaySelect
                      value={entry.method || 'cash'}
                      onChange={e => setPayments(p => ({ ...p, [inv.id]: { ...(p[inv.id] || { amount: String(balance || ''), date: todayISO() }), method: e.target.value } }))}
                      aria-label="Payment method"
                    >
                      <option value="cash">Cash</option>
                      <option value="momo">Mobile Money</option>
                      <option value="bank">Bank Transfer</option>
                    </PaySelect>
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

      <Modal isOpen={!!editInc} onClose={() => setEditInc(null)} title={editInc?.kind === 'invoice' ? 'Edit Service' : 'Edit Payment'}>
        <form onSubmit={handleSaveService}>
          {editInc?.kind === 'invoice' && (
            <>
              <Label>Pricing</Label>
              <SegBox>
                <SegBtn type="button" $active={!editSizeMode} onClick={() => setEditSizeMode(false)}>Flat Price</SegBtn>
                <SegBtn type="button" $active={editSizeMode} onClick={() => {
                  const blank = editSizeLines.length === 0 || (editSizeLines.length === 1 && !editSizeLines[0].length && !editSizeLines[0].label);
                  if (blank) {
                    setEditSizeLines(editItems.map(i => ({ ...freshSizeLine(), label: i.name, quantity: parseInt(i.quantity) || 1 })));
                  }
                  if (!editSizeRate) setEditSizeRate(settings.areaPrice || 0);
                  setEditSizeMode(true);
                }}>By Size</SegBtn>
              </SegBox>

              {editSizeMode ? (
                <>
                  <Label>Price per sq ft (GH₵)</Label>
                  <Input type="number" min="0" step="0.01" value={editSizeRate} onChange={e => setEditSizeRate(e.target.value)} />
                  <div style={{ height: '0.75rem' }} />
                  <SizePricingCalculator lines={editSizeLines} onChange={setEditSizeLines} pricePerSqFt={editSizeRate} />
                </>
              ) : (
                <>
                  {editItems.map((it, i) => (
                    <div key={i} style={{ background: '#FCF9F3', border: '1px solid #F0EEE8', borderRadius: 12, padding: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#6F240A' }}>Item {i + 1}</span>
                        {editItems.length > 1 && (
                          <button type="button" onClick={() => setEditItems(editItems.filter((_, x) => x !== i))} aria-label={`Remove item ${i + 1}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BA1A1A', display: 'flex', padding: '0.2rem' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <Label>Description *</Label>
                      <Input required value={it.name} onChange={e => setEditItems(editItems.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Banner 10x5 ft" />
                      <Label>Quantity *</Label>
                      <Input required type="number" min="1" step="1" value={it.quantity} onChange={e => setEditItems(editItems.map((x, xi) => (xi === i ? { ...x, quantity: e.target.value } : x)))} placeholder="1" />
                      <Label>Unit Price (GH₵) *</Label>
                      <Input required type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => setEditItems(editItems.map((x, xi) => (xi === i ? { ...x, unitPrice: e.target.value } : x)))} placeholder="0.00" />
                      <p style={{ fontSize: '0.9rem', color: '#25432F', fontWeight: 700, marginTop: '-0.25rem' }}>
                        Total: GH₵{(numOf(it.unitPrice) * Math.max(1, parseInt(it.quantity) || 1)).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditItems([...editItems, { name: '', quantity: '1', unitPrice: '' }])} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.55rem', border: '1px dashed #D0C8C4', borderRadius: 10, background: 'white', color: '#6F240A', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <Plus size={16} /> Add Item
                  </button>
                  <p style={{ fontSize: '0.9rem', color: '#25432F', fontWeight: 700, marginTop: '0.6rem' }}>
                    Total: GH₵{editItems.filter(i => i.name.trim()).reduce((s, i) => s + numOf(i.unitPrice) * Math.max(1, parseInt(i.quantity) || 1), 0).toFixed(2)}
                  </p>
                </>
              )}
            </>
          )}
          {editInc?.kind !== 'invoice' && (
            <>
              <Label>Service *</Label>
              <Input required value={incForm.service} onChange={e => setIncForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Website design, Consultation" autoFocus />
            </>
          )}
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
          {editInc?.kind !== 'invoice' && (
            <>
              <Label>Payment Method</Label>
              <Select value={incForm.method} onChange={e => setIncForm(f => ({ ...f, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="momo">Mobile Money</option>
                <option value="bank">Bank Transfer</option>
              </Select>
            </>
          )}
          {editInc?.kind === 'invoice' && (
            <>
              <Label>Status</Label>
              <Select value={incForm.status} onChange={e => setIncForm(f => ({ ...f, status: e.target.value }))}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </Select>
            </>
          )}
          {editInc?.kind === 'invoice' && incForm.status === 'paid' && (
            <>
              <Label>Payment Method</Label>
              <Select value={incForm.method || 'cash'} onChange={e => setIncForm(f => ({ ...f, method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="momo">Mobile Money</option>
                <option value="bank">Bank Transfer</option>
              </Select>
            </>
          )}
          {editInc?.kind !== 'invoice' && (
            <>
              <Label>Amount (GH₵) *</Label>
              <Input required type="number" min="0" step="0.01" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </>
          )}
          <Label>{editInc?.kind === 'invoice' ? 'Service Date *' : 'Payment Date *'}</Label>
          <Input required type="date" value={incForm.date} onChange={e => setIncForm(f => ({ ...f, date: e.target.value }))} />
          {editInc?.kind === 'invoice' && (
            <p style={{ fontSize: '0.85rem', color: '#55423D', margin: '-0.25rem 0 0.5rem' }}>
              {incForm.status === 'unpaid'
                ? <>This service is billed as <strong>unpaid</strong>. Use <strong>Make Payment</strong> to record deposits or the balance later.</>
                : <>This service is marked <strong>paid</strong> — the full amount is added to <strong>Total Received</strong> immediately.</>}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={() => setEditInc(null)} style={{ padding: '0.65rem 1.25rem', border: '1px solid #ddd', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button
              type="submit"
              disabled={savingEdit || (editInc?.kind === 'invoice' && editSizeMode && editSizeValid === 0)}
              style={{ padding: '0.65rem 1.25rem', border: 'none', borderRadius: 8, background: savingEdit || (editInc?.kind === 'invoice' && editSizeMode && editSizeValid === 0) ? '#997A6F' : '#6F240A', color: 'white', fontWeight: 600, cursor: savingEdit ? 'pointer' : 'pointer' }}
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteService}
        onCancel={() => setDeleteTarget(null)}
        title={deleteTarget?.kind === 'invoice' ? 'Delete Service' : 'Delete Payment'}
        message={
          deleteTarget?.kind === 'invoice'
            ? `Delete "${deleteTarget.service}" and all payments recorded against it? This cannot be undone.`
            : `Delete this payment ("${deleteTarget?.service}")? This cannot be undone.`
        }
        confirmLoading={deleting}
      />
    </div>
  );
};

export default CustomerDetail;
