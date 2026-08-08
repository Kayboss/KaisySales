import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Plus, Search, CheckCircle, Clock, Download, Edit2, Trash2, X, PlusCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import InvoicePreview from '../../components/invoice/InvoicePreview';
import { fetchInvoices, createInvoice, updateInvoice, deleteInvoice, fetchStores, fetchInventory, updateInventoryItem, createSale, deleteSale } from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { checkCreateLimit } from '../../utils/subscriptionLimits';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { formatCurrency, getCurrencySymbol } from '../../utils/currency';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitize';

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
    color: ${({ theme }) => theme.colors.text.primary};
  }
  
  input, select {
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
    color: ${({ theme }) => theme.colors.text.primary};
  }

  .save {
    background: ${({ theme }) => theme.colors.primary};
    border: none;
    color: white;
  }
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

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [limitError, setLimitError] = useState(null);
  const prevStatus = useRef('pending');

  const [formData, setFormData] = useState({
    customer: '', customerLocation: '', date: '', items: [{ name: '', quantity: 1, unitPrice: '' }], status: 'pending', discount: 0
  });

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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
      amount: `GH₵${totalAmount.toFixed(2)}`,
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

      // Deduct inventory
      try {
        const inv = await fetchInventory();
        for (const item of items) {
          const match = inv.find(i => i.name.toLowerCase() === item.name.toLowerCase());
          if (match) {
            const qty = parseInt(item.quantity) || 1;
            const newStock = Math.max(0, (parseInt(match.stock) || 0) - qty);
            await updateInventoryItem(match.id, {
              ...match,
              stock: newStock,
              status: newStock > 5 ? 'In Stock' : newStock > 0 ? 'Low Stock' : 'Out of Stock'
            });
          }
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
            amount: `GH₵${totalAmount.toFixed(2)}`
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
    const savedItems = rawItems.filter(i => i.type !== '_meta');
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
      discount
    });
    setEditId(invoice.id);
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
          if (saleRef?.saleId) {
            await deleteSale(saleRef.saleId);
          }
        }
      } catch (saleErr) {
        console.warn('Associated sale delete skipped:', saleErr);
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

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    prevStatus.current = 'pending';
    setFormData({ customer: '', customerLocation: '', date: '', items: [{ name: '', quantity: 1, unitPrice: '' }], status: 'pending', discount: 0 });
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
          <input type="text" placeholder="Search invoices, customers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'pending', 'paid'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
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
      </div>

      <InvoicesGrid>
        {invoices
          .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
          .filter(inv => !searchTerm || inv.id?.toLowerCase().includes(searchTerm.toLowerCase()) || inv.customer?.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(invoice => (
          <InvoiceCard key={invoice.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <StatusBadge $status={invoice.status}>
                {invoice.status === 'paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                {invoice.status}
              </StatusBadge>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Edit2 size={16} color="#89726C" cursor="pointer" onClick={() => handleEdit(invoice)} />
                <Trash2 size={16} color="#BA1A1A" cursor="pointer" onClick={() => setDeleteTarget(invoice)} />
              </div>
            </div>
            
            <div style={{ color: '#55423D', fontSize: '0.75rem', fontWeight: 600 }}>{invoice.id}</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0.25rem 0', color: '#1C1C18' }}>{invoice.customer}</h3>
            <Amount className="data-tabular">{invoice.amount}</Amount>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F0EEE8' }}>
              <span style={{ fontSize: '0.875rem', color: '#55423D' }}>Due: {invoice.date}</span>
              <Download size={18} color="#6F240A" cursor="pointer" onClick={() => setPreviewInvoice(invoice)} />
            </div>
          </InvoiceCard>
        ))}
      </InvoicesGrid>

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
