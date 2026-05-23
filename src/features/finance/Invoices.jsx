import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Search, CheckCircle, Clock, Download, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import InvoicePreview from '../../components/invoice/InvoicePreview';
import { fetchInvoices, createInvoice, updateInvoice, deleteInvoice, fetchStores } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';

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
  const [invoices, setInvoices] = useState([]);
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customer: '', date: '', quantity: 1, unitPrice: '', status: 'pending'
  });

  const loadData = async () => {
    try {
      const [data, storeData] = await Promise.all([fetchInvoices(), fetchStores()]);
      setInvoices(data.reverse());
      setStores(storeData);
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
    const totalAmount = parseFloat(formData.quantity) * parseFloat(formData.unitPrice);
    
    const invoicePayload = {
      customer: formData.customer,
      date: formData.date,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      status: formData.status,
      amount: `GH₵${totalAmount.toFixed(2)}`
    };
    
    try {
      if (isEditing) {
        await updateInvoice(editId, invoicePayload);
      } else {
        await createInvoice(invoicePayload);
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save invoice', error);
      alert('Failed to save invoice: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (invoice) => {
    setFormData({
      customer: invoice.customer,
      date: invoice.date,
      quantity: invoice.quantity || 1,
      unitPrice: invoice.unitPrice || parseFloat(invoice.amount.replace('GH₵', '').replace(',', '')),
      status: invoice.status
    });
    setEditId(invoice.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteInvoice(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete invoice', error);
    }
    setDeleteTarget(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ customer: '', date: '', quantity: 1, unitPrice: '', status: 'pending' });
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Invoice" : "Create New Invoice"}>
        <form onSubmit={handleSave}>
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
                onChange={e => setFormData({...formData, customer: e.target.value})}
              >
                <option value="">-- Select a store --</option>
                {stores.map(store => (
                  <option key={store.id} value={store.name}>{store.name}</option>
                ))}
              </select>
            )}
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
          <FormRow>
            <FormGroup>
              <label>Quantity</label>
              <input 
                type="number" 
                min="1"
                required 
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
            </FormGroup>
            <FormGroup>
              <label>Unit Price (GH₵)</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                value={formData.unitPrice}
                onChange={e => setFormData({...formData, unitPrice: e.target.value})}
                placeholder="0.00" 
              />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup>
              <label>Total Amount (GH₵)</label>
              <input 
                type="text" 
                readOnly 
                value={(formData.quantity && formData.unitPrice) ? (formData.quantity * formData.unitPrice).toFixed(2) : '0.00'}
                style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
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
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Invoice" : "Save Invoice")}</button>
          </ModalActions>
        </form>
      </Modal>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          padding: '0.75rem 1.25rem', 
          borderRadius: '8px', 
          border: '1px solid #89726C',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Search size={18} color="#89726C" />
          <input type="text" placeholder="Search invoices, customers..." style={{ border: 'none', outline: 'none', width: '100%' }} />
        </div>
      </div>

      <InvoicesGrid>
        {invoices.map(invoice => (
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
        <InvoicePreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Invoice"
          message={'Delete invoice ' + deleteTarget.id + ' for ' + deleteTarget.customer + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Invoices;
