import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Plus, Search, CheckCircle, Clock, Download, Edit2, Trash2, X, PlusCircle, DollarSign, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import IconAction from '../../components/ui/IconAction';
import InvoicePreview from '../../components/invoice/InvoicePreview';
import { fetchInvoices, createInvoice, updateInvoice, deleteInvoice, fetchStores, fetchInventory, updateInventoryItem, createSale, deleteSale, deleteServiceIncome } from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { checkCreateLimit } from '../../utils/subscriptionLimits';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { formatCurrency, getCurrencySymbol } from '../../utils/currency';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitize';
import { applyStockDelta, resolveMinStock, resolveStock } from '../../utils/inventory';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const InvoicesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const InvoiceCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  position: relative;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.ambient};
  }
`;

const StatusBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: ${props => props.$status === 'paid' ? 'rgba(37, 67, 47, 0.1)' : 'rgba(135, 82, 0, 0.1)'};
  color: ${props => props.$status === 'paid' ? '#25432F' : '#875200'};
  text-transform: uppercase;
  width: fit-content;
  margin-bottom: 1rem;
`;

const Amount = styled.div`
  font-size: 1.5rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
  margin: 0.5rem 0;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: none;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;

  &:hover {
    filter: brightness(1.2);
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.main};
  }
  
  input, select, textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-family: inherit;
    font-size: 1rem;
    
    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
      box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
    }
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const MobileLabel = styled.span`
  display: none;
  font-size: 0.65rem;
  font-weight: 600;
  color: #89726C;
  margin-bottom: 0.2rem;

  @media (max-width: 768px) {
    display: block;
  }
`;

const FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const FormGridHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 100px 100px 36px;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #89726C;

  @media (max-width: 768px) {
    display: none;
  }
`;

const LineItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 100px 100px 36px;
  gap: 0.75rem;
  align-items: end;
  margin-bottom: 0.75rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #FCF9F3;
    border-radius: 8px;
    border: 1px solid #F0EEE8;

    & > :nth-child(1) { grid-column: 1 / -1; } /* item selector */
    & > :nth-child(2) { grid-column: 1; }      /* quantity */
    & > :nth-child(3) { grid-column: 2; }      /* price */
    & > :nth-child(4) { grid-column: 1; }      /* total */
    & > :nth-child(5) { grid-column: 2; justify-self: end; align-self: end; } /* remove */
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid ${({ theme }) => theme.colors.outlineVariant};

  button {
    padding: 0.75rem 1.5rem;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-weight: 600;
    cursor: pointer;
  }

  .cancel {
    background: white;
    border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
    color: ${({ theme }) => theme.colors.text.main};
  }

  .save {
    background: ${({ theme }) => theme.colors.primary};
    border: none;
    color: white;
  }
`;

const VIEW_KEY = 'kaisysales:invoiceView';
const PAGE_SIZE = 12;

const ViewToggle = styled.div`
  display: flex;
  gap: 0.2rem;
  background: white;
  border: 1px solid #D0C8C4;
  border-radius: 8px;
  padding: 0.2rem;
`;

const ViewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border-radius: 6px;
  border: none;
  background: ${props => props.$active ? '#6F240A' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  svg { display: block; }
`;

const ListCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  overflow: hidden;
`;

const ListHead = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.7fr) 130px 118px 110px;
  gap: 1rem;
  align-items: center;
  padding: 0.7rem 1.25rem;
  background: #FCF9F3;
  border-bottom: 1px solid #F0EEE8;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #89726C;

  @media (max-width: 900px) { display: none; }
`;

const ListRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.7fr) 130px 118px 110px;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #F0EEE8;
  transition: background 0.15s ease;

  &:last-child { border-bottom: none; }
  &:hover { background: #FCF9F3; }

  @media (max-width: 900px) {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'id amount'
      'status actions'
      'items items';
    row-gap: 0.6rem;
    column-gap: 0.75rem;
    padding: 1rem 1rem;
  }
`;

const Cell = styled.div`
  min-width: 0;

  @media (max-width: 900px) {
    &.c-id { grid-area: id; }
    &.c-items { grid-area: items; }
    &.c-amount { grid-area: amount; text-align: right; }
    &.c-status { grid-area: status; }
    &.c-actions { grid-area: actions; justify-content: flex-end; }
  }
`;

const IdText = styled.div`
  font-size: 0.75rem;
  font-weight: 700;
  color: #89726C;
`;

const NameText = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #1C1C18;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetaText = styled.div`
  font-size: 0.78rem;
  color: #55423D;
`;

const ItemsText = styled.div`
  font-size: 0.82rem;
  color: #55423D;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowAmount = styled.div`
  font-size: 1.05rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
`;

const MarkPaidMini = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: #25432F;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  transition: filter 0.2s;

  &:hover { filter: brightness(1.1); }
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
`;

const PageSummary = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #55423D;
`;

const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
`;

const PageButton = styled.button`
  min-width: 2.15rem;
  height: 2.15rem;
  padding: 0 0.55rem;
  border-radius: 6px;
  border: 1px solid ${props => props.$active ? '#6F240A' : '#D0C8C4'};
  background: ${props => props.$active ? '#6F240A' : 'white'};
  color: ${props => props.$active ? 'white' : '#1C1C18'};
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: filter 0.15s ease;

  &:hover:not(:disabled) { filter: brightness(0.97); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const EmptyState = styled.div`
  padding: 3rem 1.5rem;
  text-align: center;
  background: white;
  border: 1px dashed #D0C8C4;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: #55423D;
`;

const Invoices = () => {
  const { currency, subscriptionPlan } = useSettingsStore();
  const { businessName, phone: businessPhone, location: businessLocation } = useSettingsStore();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [invoices, setInvoices] = useState([]);
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  // Retained so an edit can correct the stock movement the original save made,
  // rather than deducting the whole invoice a second time.
  const [editingInvoice, setEditingInvoice] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [limitError, setLimitError] = useState(null);
  const prevStatus = useRef('pending');

  const [formData, setFormData] = useState({
    customer: '', customerLocation: '', date: '', items: [{ name: '', quantity: 1, unitPrice: '' }], status: 'pending', discount: 0, notes: ''
  });

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card';
    } catch {
      return 'card';
    }
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, viewMode); } catch { /* storage unavailable */ }
  }, [viewMode]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!term) return true;
      const items = (Array.isArray(inv.items) ? inv.items : []).filter(i => !i.type);
      const haystack = [inv.id, inv.customer, inv.notes, ...items.map(i => i.name)]
        .map(v => String(v ?? '').toLowerCase());
      return haystack.some(v => v.includes(term));
    });
  }, [invoices, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedInvoices = filteredInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredInvoices.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredInvoices.length);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) out.push('gap-start');
    for (let i = start; i <= end; i++) out.push(i);
    if (end < totalPages - 1) out.push('gap-end');
    out.push(totalPages);
    return out;
  }, [currentPage, totalPages]);

  const addItem = () => {
    setFormData(prev => ({ ...prev, items: [...prev.items, { name: '', quantity: 1, unitPrice: '' }] }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'name') {
        const selected = inventoryItems.find(i => i.name === value);
        if (selected?.price) {
          items[index].unitPrice = parseFloat(selected.price.replace(/[^0-9.]/g, ''));
        }
      }
      return { ...prev, items };
    });
  };

  const lineTotal = (item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    return q * p;
  };

  const invoiceSubtotal = formData.items.reduce((sum, i) => sum + lineTotal(i), 0);
  const discountPct = parseFloat(formData.discount) || 0;
  const invoiceTotal = invoiceSubtotal * (1 - discountPct / 100);

  const loadData = async () => {
    try {
      const [data, storeData, inv] = await Promise.all([fetchInvoices(), fetchStores(), fetchInventory()]);
      setInvoices(data);
      setStores(storeData);
      setInventoryItems(inv);
    } catch (error) {
      console.error('Failed to load invoices', error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLimitError(null);

    if (!isEditing) {
      const check = await checkCreateLimit(supabase, user?.uid, subscriptionPlan, 'invoices');
      if (!check.allowed) {
        setLimitError(check);
        setSaving(false);
        return;
      }
    }

    const items = formData.items.filter(i => i.name);
    const subtotal = items.reduce((sum, i) => sum + (sanitizeNumber(i.quantity) * sanitizeNumber(i.unitPrice)), 0);
    const totalQty = items.reduce((sum, i) => sum + (sanitizeNumber(i.quantity) || 0), 0);
    const discountPct = sanitizeNumber(formData.discount) || 0;
    const totalAmount = subtotal * (1 - discountPct / 100);
    const isPaid = formData.status === 'paid';
    
    const invoicePayload = {
      customer: sanitizeInput(formData.customer, 100),
      customerLocation: sanitizeInput(formData.customerLocation, 200),
      date: formData.date,
      quantity: totalQty,
      unitPrice: items[0]?.unitPrice || '',
      status: formData.status,
      amount: `GHS ${totalAmount.toFixed(2)}`,
      notes: sanitizeInput(formData.notes, 500),
      items: [
        ...items.map(i => ({ name: sanitizeInput(i.name, 100), quantity: sanitizeNumber(i.quantity), unitPrice: sanitizeNumber(i.unitPrice) })),
        ...(discountPct > 0 ? [{ type: '_meta', discount: discountPct }] : [])
      ]
    };
    
    try {
      let invoiceId = isEditing ? editId : null;
      if (isEditing) {
        await updateInvoice(editId, invoicePayload);
      } else {
        const created = await createInvoice(invoicePayload);
        invoiceId = created?.id;
      }

      // Deduct inventory.
      //
      // On create each line is taken out of stock. On edit only the difference
      // is applied: the original save already deducted those units, so
      // deducting the whole invoice again silently lost stock every time an
      // invoice was corrected. Lines removed by an edit are returned in full.
      try {
        const inv = await fetchInventory();
        const previousLines = (Array.isArray(editingInvoice?.items) ? editingInvoice.items : [])
          .filter(i => !i.type);
        const nextLines = items.filter(i => i.name);

        const movementFor = (name) => {
          const nextQty = parseInt(nextLines.find(i => i.name.toLowerCase() === name.toLowerCase())?.quantity) || 0;
          const previousQty = isEditing
            ? (parseInt(previousLines.find(i => i.name?.toLowerCase() === name.toLowerCase())?.quantity) || 0)
            : 0;
          // Units leaving stock: the increase against what was already deducted.
          return { delta: nextQty - previousQty };
        };

        const touchedNames = new Set(nextLines.map(i => i.name));
        if (isEditing) previousLines.forEach(i => touchedNames.add(i.name));

        const shortfalls = [];
        for (const name of touchedNames) {
          const match = inv.find(i => i.name.toLowerCase() === name.toLowerCase());
          if (!match) continue;
          const { delta } = movementFor(name);
          if (delta === 0) continue;
          const applied = applyStockDelta(resolveStock(match), delta, resolveMinStock(match));
          await updateInventoryItem(match.id, {
            ...match,
            stock: applied.stock,
            status: applied.status
          });
          if (applied.shortfall > 0) {
            shortfalls.push(`${match.name} is short by ${applied.shortfall} unit(s)`);
          }
        }
        if (shortfalls.length > 0) {
          alert(`Stock was set to 0 for the affected item(s) because there were not enough units:\n\n${shortfalls.join('\n')}`);
        }
      } catch (invErr) {
        console.warn('Inventory auto-deduct skipped:', invErr);
      }

      // Create sale if newly paid
      const shouldCreateSale = isPaid && (!isEditing || prevStatus.current !== 'paid');
      if (shouldCreateSale) {
        try {
          const inv = await fetchInventory();
          const firstItem = items[0];
          const invMatch = firstItem ? inv.find(i => i.name.toLowerCase() === firstItem.name.toLowerCase()) : null;
          const saleResult = await createSale({
            item: firstItem?.name || '',
            category: invMatch?.category || '',
            quantity: totalQty,
            unitPrice: firstItem?.unitPrice || '',
            paymentMethod: 'Invoice',
            date: formData.date || new Date().toISOString().split('T')[0],
            time: new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
            amount: `GHS ${totalAmount.toFixed(2)}`
          });
          // Store sale reference back in invoice
          if (invoiceId && saleResult?.id) {
            const currentInvoice = await fetchInvoices().then(all => all.find(i => String(i.id) === String(invoiceId)));
            if (currentInvoice) {
              const rawItems = Array.isArray(currentInvoice.items) ? currentInvoice.items : [];
              const updatedItems = [...rawItems.filter(i => i.type !== '_saleId'), { type: '_saleId', saleId: saleResult.id }];
              await updateInvoice(invoiceId, { items: updatedItems });
            }
          }
        } catch (saleErr) {
          console.warn('Sale creation from invoice skipped:', saleErr);
        }

        // No `service_income` row here. A retail invoice already writes its own
        // `sales` row above, and writing a third row into the services-mode
        // income table leaked retail revenue into Income Tracking and double
        // counted it in the admin overview.
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save invoice', error);
      alert('Failed to save invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (invoice) => {
    const rawItems = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [];
    const metaItem = rawItems.find(i => i.type === '_meta');
    const discount = metaItem?.discount || 0;
    const savedItems = rawItems.filter(i => i.type !== '_meta' && i.type !== '_saleId' && i.type !== '_incomeId');
    const finalItems = savedItems.length > 0
      ? savedItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice }))
      : [{ name: '', quantity: invoice.quantity || 1, unitPrice: invoice.unitPrice || parseFloat(invoice.amount.replace(/[^\d.-]/g, '')) }];
    prevStatus.current = invoice.status;
    setFormData({
      customer: invoice.customer,
      customerLocation: invoice.customerLocation || '',
      date: invoice.date,
      items: finalItems,
      status: invoice.status,
      discount,
      notes: invoice.notes || ''
    });
    setEditId(invoice.id);
    setEditingInvoice(invoice);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      try {
        const allInvoices = await fetchInvoices();
        const target = allInvoices.find(i => String(i.id) === String(id));
        if (target) {
          const rawItems = Array.isArray(target.items) ? target.items : [];
          const saleRef = rawItems.find(i => i.type === '_saleId');
          if (saleRef?.saleId) await deleteSale(saleRef.saleId);
          const incomeRef = rawItems.find(i => i.type === '_incomeId');
          if (incomeRef?.incomeId) await deleteServiceIncome(incomeRef.incomeId);

          // Return the units this invoice took out of stock. Metadata markers are
          // skipped so the discount row is never treated as a stock line.
          const soldLines = rawItems.filter(i => !i.type && i.name);
          if (soldLines.length > 0) {
            const inv = await fetchInventory();
            for (const line of soldLines) {
              const match = inv.find(i => i.name.toLowerCase() === line.name.toLowerCase());
              if (!match) continue;
              const applied = applyStockDelta(
                resolveStock(match),
                -(parseInt(line.quantity) || 0),
                resolveMinStock(match)
              );
              await updateInventoryItem(match.id, {
                ...match,
                stock: applied.stock,
                status: applied.status
              });
            }
          }
        }
      } catch (saleErr) {
        console.warn('Associated sale/income delete skipped:', saleErr);
      }

      await deleteInvoice(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete invoice', error);
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  const handleMarkPaid = async (invoice) => {
    const rawItems = Array.isArray(invoice.items) ? invoice.items : [];
    const firstItem = rawItems.find(i => !i.type) || {};
    try {
      await updateInvoice(invoice.id, { status: 'paid' });

      try {
        const saleResult = await createSale({
          item: firstItem.name || 'Wholesale Invoice',
          category: 'Sales',
          quantity: firstItem.quantity || 1,
          unitPrice: firstItem.unitPrice || '',
          paymentMethod: 'Invoice',
          date: invoice.date || new Date().toISOString().split('T')[0],
          time: new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
          amount: invoice.amount,
        });
        if (saleResult?.id) {
          const updatedItems = [...rawItems.filter(i => i.type !== '_saleId'), { type: '_saleId', saleId: saleResult.id }];
          await updateInvoice(invoice.id, { items: updatedItems });
        }
      } catch (e) {
        console.warn('Quick mark paid: sale creation skipped', e);
      }

      // No `service_income` row here either, for the same reason as the save
      // path: the mirrored `sales` row above is the retail record of this sale.

      await loadData();
    } catch (error) {
      console.error('Failed to mark invoice as paid', error);
      alert('Failed to update invoice. Please try again.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setEditingInvoice(null);
    prevStatus.current = 'pending';
    setFormData({ customer: '', customerLocation: '', date: '', items: [{ name: '', quantity: 1, unitPrice: '' }], status: 'pending', discount: 0, notes: '' });
  };

  const handleExport = () => {
    const headers = {
      id: 'Invoice ID',
      date: 'Date',
      customer: 'Customer',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      amount: 'Total Amount',
      status: 'Status'
    };
    const csv = convertToCSV(invoices, headers);
    downloadCSV(csv, `Invoices_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Wholesale Invoices</h1>
          <p style={{ color: '#55423D' }}>Manage your high-volume partner transactions.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ActionButton onClick={handleExport} style={{ background: 'white', color: '#6F240A', border: '1px solid #6F240A' }}>
            Export CSV
          </ActionButton>
          <ActionButton onClick={() => { setIsEditing(false); setIsModalOpen(true); }}>
            <Plus size={18} />
            Create Invoice
          </ActionButton>
        </div>
      </Header>

      <Modal wide isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Invoice" : "Create New Invoice"}>
        <form onSubmit={handleSave}>
          {limitError && (
            <div style={{ padding: '1rem', background: '#FFF0F0', borderRadius: '8px', border: '1px solid #FFD0D0', marginBottom: '1rem', fontSize: '0.9rem', color: '#CC0000' }}>
              <strong>Limit reached!</strong><br />
              {limitError.message}
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" onClick={() => navigate('/settings?tab=subscription')} style={{ padding: '0.5rem 1rem', background: '#6F240A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                  Upgrade Plan
                </button>
                <button type="button" onClick={() => setLimitError(null)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#6F240A', border: '1px solid #6F240A', borderRadius: '6px', cursor: 'pointer', marginLeft: '0.5rem', fontWeight: 600 }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <FormGroup>
            <label>Customer (Retail Store)</label>
            {stores.length === 0 ? (
              <div style={{ padding: '0.75rem', background: '#FFF8F0', borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '0.9rem', color: '#55423D' }}>
                No retail stores saved yet.{' '}
                <a href="/retail-stores" style={{ color: '#6F240A', fontWeight: 700 }}>Add a store first</a>.
              </div>
            ) : (
              <select 
                required 
                value={formData.customer}
                onChange={e => {
                  const selected = stores.find(s => s.name === e.target.value);
                  setFormData({...formData, customer: e.target.value, customerLocation: selected?.location || ''});
                }}
              >
                <option value="">-- Select a store --</option>
                {stores.map(store => (
                  <option key={store.id} value={store.name}>{store.name}</option>
                ))}
              </select>
            )}
          </FormGroup>
          <FormGroup>
            <label>Customer Location</label>
            <input 
              type="text" 
              value={formData.customerLocation}
              onChange={e => setFormData({...formData, customerLocation: e.target.value})}
              placeholder="Location"
            />
          </FormGroup>
          <FormGroup>
            <label>Due Date</label>
            <input 
              type="date" 
              required 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </FormGroup>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#1C1C18' }}>Items</label>
              <button type="button" onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1px solid #D0C8C4', borderRadius: '6px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#6F240A' }}>
                <PlusCircle size={14} /> Add Item
              </button>
            </div>
            <FormGridHeader>
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Price</span>
              <span style={{ textAlign: 'right' }}>Total</span>
              <span></span>
            </FormGridHeader>
            {formData.items.map((item, idx) => (
              <LineItemRow key={idx}>
                {inventoryItems.length === 0 ? (
                  <div style={{ padding: '0.5rem', background: '#FFF8F0', borderRadius: '6px', border: '1px solid #F0EEE8', fontSize: '0.8rem', color: '#55423D' }}>
                    <a href="/inventory" style={{ color: '#6F240A', fontWeight: 700 }}>Add inventory first</a>.
                  </div>
                ) : (
                  <FieldWrapper>
                    <MobileLabel>Item</MobileLabel>
                    <select 
                      required={idx === 0}
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #D0C8C4', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'inherit' }}
                    >
                      <option value="">-- Select --</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.name}>
                          {inv.name} {inv.stock > 0 ? `(${inv.stock})` : '(0)'}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>
                )}
                <FieldWrapper>
                  <MobileLabel>Qty</MobileLabel>
                  <input 
                    type="number" 
                    min="1"
                    required={idx === 0}
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #D0C8C4', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'right' }}
                  />
                </FieldWrapper>
                <FieldWrapper>
                  <MobileLabel>Price</MobileLabel>
                  <input 
                    type="number" 
                    step="0.01"
                    required={idx === 0}
                    value={item.unitPrice}
                    onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #D0C8C4', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'right' }}
                    placeholder="0.00"
                  />
                </FieldWrapper>
                <FieldWrapper>
                  <MobileLabel>Total</MobileLabel>
                  <div style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#6F240A', fontSize: '0.85rem' }}>
                    {formatCurrency(lineTotal(item), currency)}
                  </div>
                </FieldWrapper>
                <button 
                  type="button" 
                  onClick={() => removeItem(idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BA1A1A', padding: '0.6rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Remove item"
                >
                  <X size={16} />
                </button>
              </LineItemRow>
            ))}
          </div>

          <FormRow>
            <FormGroup>
              <label>Discount (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                step="0.5" 
                value={formData.discount}
                onChange={e => setFormData({...formData, discount: e.target.value})}
                placeholder="0" 
              />
            </FormGroup>
            <FormGroup>
              <label>Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </FormGroup>
          </FormRow>
          <FormGroup>
            <label>Total Amount ({getCurrencySymbol(currency)})</label>
            <input 
              type="text" 
              readOnly 
              value={formatCurrency(invoiceTotal, currency)}
              style={{ background: '#f5f5f5', cursor: 'not-allowed', fontWeight: 800, fontSize: '1.1rem', color: '#6F240A' }}
            />
          </FormGroup>
          <FormGroup>
            <label>Notes (optional)</label>
            <textarea 
              rows={3} 
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Payment terms, payment information, additional details..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </FormGroup>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Invoice" : "Save Invoice")}</button>
          </ModalActions>
        </form>
      </Modal>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          padding: '0.75rem 1.25rem', 
          borderRadius: '8px', 
          border: '1px solid #89726C',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: '200px'
        }}>
          <Search size={18} color="#89726C" />
          <input type="text" placeholder="Search invoices, customers..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ border: 'none', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'pending', 'paid'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: `1px solid ${statusFilter === status ? '#6F240A' : '#D0C8C4'}`,
                background: statusFilter === status ? '#6F240A' : 'white',
                color: statusFilter === status ? 'white' : '#1C1C18',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
        <ViewToggle role="group" aria-label="Invoice view">
          <ViewButton type="button" $active={viewMode === 'card'} onClick={() => setViewMode('card')} aria-pressed={viewMode === 'card'} title="Card view">
            <LayoutGrid size={15} /> Cards
          </ViewButton>
          <ViewButton type="button" $active={viewMode === 'list'} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} title="List view">
            <List size={15} /> List
          </ViewButton>
        </ViewToggle>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState>
          <p style={{ fontWeight: 700, color: '#1C1C18', margin: '0 0 0.35rem' }}>No invoices found</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {invoices.length === 0 ? 'Create your first invoice to get started.' : 'Try a different search or status filter.'}
          </p>
        </EmptyState>
      ) : viewMode === 'list' ? (
        <ListCard>
          <ListHead>
            <span>Invoice</span>
            <span>Items</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </ListHead>
          {pagedInvoices.map(invoice => {
            const lines = (Array.isArray(invoice.items) ? invoice.items : []).filter(i => !i.type);
            const first = lines[0];
            const extra = lines.length - 1;
            return (
              <ListRow key={invoice.id}>
                <Cell className="c-id">
                  <IdText>{invoice.id}</IdText>
                  <NameText>{invoice.customer}</NameText>
                  <MetaText>Due: {invoice.date}</MetaText>
                </Cell>
                <Cell className="c-items">
                  {lines.length === 0 ? (
                    <ItemsText>Wholesale order</ItemsText>
                  ) : (
                    <ItemsText>
                      {first.name} ×{first.quantity || 1}
                      {extra > 0 ? ` +${extra} more` : ''}
                    </ItemsText>
                  )}
                </Cell>
                <Cell className="c-amount">
                  <RowAmount className="data-tabular">{formatCurrency(invoice.amount, currency)}</RowAmount>
                </Cell>
                <Cell className="c-status">
                  <StatusBadge $status={invoice.status} style={{ marginBottom: 0 }}>
                    {invoice.status === 'paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                    {invoice.status}
                  </StatusBadge>
                </Cell>
                <Cell className="c-actions">
                  <RowActions>
                    {invoice.status !== 'paid' && (
                      <MarkPaidMini onClick={() => handleMarkPaid(invoice)}>
                        <DollarSign size={13} /> Mark Paid
                      </MarkPaidMini>
                    )}
                    <IconAction label={`Edit invoice ${invoice.id} for ${invoice.customer}`} onClick={() => handleEdit(invoice)}>
                      <Edit2 size={16} color="#89726C" />
                    </IconAction>
                    <IconAction label={`Download invoice ${invoice.id} for ${invoice.customer}`} onClick={() => setPreviewInvoice(invoice)}>
                      <Download size={16} color="#6F240A" />
                    </IconAction>
                    <IconAction label={`Delete invoice ${invoice.id} for ${invoice.customer}`} onClick={() => setDeleteTarget(invoice)}>
                      <Trash2 size={16} color="#BA1A1A" />
                    </IconAction>
                  </RowActions>
                </Cell>
              </ListRow>
            );
          })}
        </ListCard>
      ) : (
        <InvoicesGrid>
          {pagedInvoices.map(invoice => (
          <InvoiceCard key={invoice.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <StatusBadge $status={invoice.status}>
                {invoice.status === 'paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                {invoice.status}
              </StatusBadge>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <IconAction label={`Edit invoice ${invoice.id} for ${invoice.customer}`} onClick={() => handleEdit(invoice)}>
                  <Edit2 size={16} color="#89726C" />
                </IconAction>
                <IconAction label={`Delete invoice ${invoice.id} for ${invoice.customer}`} onClick={() => setDeleteTarget(invoice)}>
                  <Trash2 size={16} color="#BA1A1A" />
                </IconAction>
              </div>
            </div>
            
            <div style={{ color: '#55423D', fontSize: '0.75rem', fontWeight: 600 }}>{invoice.id}</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0.25rem 0', color: '#1C1C18' }}>{invoice.customer}</h3>
            <Amount className="data-tabular">{formatCurrency(invoice.amount, currency)}</Amount>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F0EEE8' }}>
              <span style={{ fontSize: '0.875rem', color: '#55423D' }}>Due: {invoice.date}</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {invoice.status !== 'paid' && (
                  <button onClick={() => handleMarkPaid(invoice)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#25432F', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, transition: 'filter 0.2s' }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                    <DollarSign size={14} />
                    Mark Paid
                  </button>
                )}
                <IconAction label={`Download invoice ${invoice.id} for ${invoice.customer}`} onClick={() => setPreviewInvoice(invoice)}>
                  <Download size={18} color="#6F240A" />
                </IconAction>
              </div>
            </div>
          </InvoiceCard>
        ))}
        </InvoicesGrid>
      )}

      {filteredInvoices.length > PAGE_SIZE && (
        <Pagination>
          <PageSummary>
            Showing {rangeStart}–{rangeEnd} of {filteredInvoices.length}
          </PageSummary>
          <PageControls>
            <PageButton type="button" onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="First page" title="First page">
              <ChevronLeft size={15} />
            </PageButton>
            <PageButton type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
              <ChevronLeft size={15} />
            </PageButton>
            {pageNumbers.map(n => (
              typeof n === 'number' ? (
                <PageButton key={n} type="button" $active={n === currentPage} onClick={() => setPage(n)} aria-current={n === currentPage ? 'page' : undefined}>
                  {n}
                </PageButton>
              ) : (
                <span key={n} style={{ padding: '0 0.2rem', color: '#89726C', fontSize: '0.8rem' }}>…</span>
              )
            ))}
            <PageButton type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
              <ChevronRight size={15} />
            </PageButton>
            <PageButton type="button" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} aria-label="Last page" title="Last page">
              <ChevronRight size={15} />
            </PageButton>
          </PageControls>
        </Pagination>
      )}

      {previewInvoice && (
        <InvoicePreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} businessName={businessName} businessPhone={businessPhone} businessLocation={businessLocation} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Delete Invoice"
          message={'Delete invoice ' + deleteTarget.id + ' for ' + deleteTarget.customer + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          confirmLoading={deleting}
        />
      )}
    </div>
  );
};

export default Invoices;
