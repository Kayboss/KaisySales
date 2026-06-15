import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Store, MapPin, Phone, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchStores, createStore, updateStore, deleteStore, fetchInvoices } from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatCurrencyShort, getCurrencySymbol } from '../../utils/currency';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const StoresGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
`;

const StoreCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  display: flex;
  flex-direction: column;
  position: relative;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadows.ambient};
  }
`;

const StoreHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.25rem;
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(135, 82, 0, 0.05);
  color: #875200;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StoreName = styled.h3`
  font-size: 1.25rem;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
  margin: 0;
`;

const StatusBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(37, 67, 47, 0.1);
  color: #25432F;
  text-transform: uppercase;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.875rem;
  margin-bottom: 0.75rem;

  svg {
    flex-shrink: 0;
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

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 1rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 1rem;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.875rem;

  &.data-tabular {
    font-family: 'JetBrains Mono', monospace;
  }
`;

const RetailStores = () => {
  const { currency } = useSettingsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', type: '', location: '', phone: '', contactName: ''
  });

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyInvoices, setHistoryInvoices] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [storeInvoiceCounts, setStoreInvoiceCounts] = useState({});

  const loadData = async () => {
    try {
      const [data, allInvoices] = await Promise.all([fetchStores(), fetchInvoices()]);
      setStores(data);
      const counts = {};
      allInvoices.forEach(inv => {
        if (inv.customer) {
          counts[inv.customer] = (counts[inv.customer] || 0) + 1;
        }
      });
      setStoreInvoiceCounts(counts);
    } catch (error) {
      console.error('Failed to load stores', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const storePayload = {
      ...formData,
      status: 'Active'
    };
    
    try {
      if (isEditing) {
        await updateStore(editId, storePayload);
      } else {
        await createStore(storePayload);
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save store', error);
      alert('Failed to save store: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (store) => {
    setFormData({
      name: store.name,
      type: store.type || '',
      location: store.location,
      phone: store.phone,
      contactName: store.contactName
    });
    setEditId(store.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteStore(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete store', error);
    }
    setDeleteTarget(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ name: '', type: '', location: '', phone: '', contactName: '' });
  };

  const handleViewHistory = async (store) => {
    setSelectedStore(store);
    try {
      const allInvoices = await fetchInvoices();
      const filtered = allInvoices.filter(inv => inv.customer === store.name);
      setHistoryInvoices(filtered);
      setIsHistoryModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch invoice history', error);
    }
  };

  const parseAmt = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return 0;
    return parseFloat(v.replace(/[^\d.]/g, '')) || 0;
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setHistoryInvoices([]);
    setSelectedStore(null);
    setSelectedInvoice(null);
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    store.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Retail Stores</h1>
          <p style={{ color: '#55423D' }}>Manage the retail shops and boutiques you supply to.</p>
        </div>
        <ActionButton onClick={() => { setIsEditing(false); setIsModalOpen(true); }}>
          <Plus size={18} />
          Add Store
        </ActionButton>
      </Header>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Retail Store" : "Add Retail Store"}>
        <form onSubmit={handleSave}>
          <FormGroup>
            <label>Store Name</label>
            <input 
              type="text" 
              required 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Accra Craft Collective" 
            />
          </FormGroup>
          <FormRow>
            <FormGroup>
              <label>Store Type</label>
              <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="">Select Type</option>
                <option value="Boutique">Boutique</option>
                <option value="Concept Store">Concept Store</option>
                <option value="Retail Store">Retail Store</option>
                <option value="Wholesaler">Wholesaler</option>
              </select>
            </FormGroup>
            <FormGroup>
              <label>Location</label>
              <input 
                type="text" 
                required 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                placeholder="City, Country" 
              />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup>
              <label>Contact Person</label>
              <input 
                type="text" 
                required 
                value={formData.contactName}
                onChange={e => setFormData({...formData, contactName: e.target.value})}
                placeholder="Full Name" 
              />
            </FormGroup>
            <FormGroup>
              <label>Phone Number</label>
              <input 
                type="text" 
                required 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="+233..." 
              />
            </FormGroup>
          </FormRow>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Store" : "Save Store")}</button>
          </ModalActions>
        </form>
      </Modal>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          padding: '0.875rem 1.25rem', 
          borderRadius: '8px', 
          border: '1px solid #89726C',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Search size={18} color="#89726C" />
          <input 
            type="text" 
            placeholder="Search stores by name or location..." 
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem' }} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <StoresGrid>
        {filteredStores.map(store => (
          <StoreCard key={store.id}>
            <StoreHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <IconWrapper>
                  <Store size={24} />
                </IconWrapper>
                <div>
                  <StoreName>{store.name}</StoreName>
                  <StatusBadge>{store.status || 'Active'}</StatusBadge>
                </div>
              </div>
              <div>
                <Edit2 size={16} color="#89726C" cursor="pointer" onClick={() => handleEdit(store)} />
                <Trash2 size={16} color="#BA1A1A" cursor="pointer" onClick={() => setDeleteTarget(store)} />
              </div>
            </StoreHeader>
            <InfoRow>
              <MapPin size={16} />
              {store.location}
            </InfoRow>
            <InfoRow>
              <Phone size={16} />
              {store.phone}
            </InfoRow>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span 
                style={{ color: '#6F240A', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                onClick={() => handleViewHistory(store)}
              >
                View Invoice History →
              </span>
              {storeInvoiceCounts[store.name] > 0 && (
                <span style={{ background: '#6F240A', color: 'white', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {storeInvoiceCounts[store.name]} invoice{storeInvoiceCounts[store.name] !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </StoreCard>
        ))}
      </StoresGrid>

      <Modal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} title={`Invoice History - ${selectedStore?.name || ''}`}>
        {historyInvoices.length === 0 ? (
          <p style={{ color: '#55423D', textAlign: 'center', padding: '2rem' }}>
            No invoices found for this store.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice ID</Th>
                <Th>Date</Th>
                <Th>Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {historyInvoices.map(inv => (
                <tr key={inv.id}>
                  <Td>{inv.id}</Td>
                  <Td>{inv.date}</Td>
                  <Td className="data-tabular">{formatCurrency(parseAmt(inv.amount), currency)}</Td>
                  <Td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: (inv.status || '').toLowerCase() === 'paid' ? 'rgba(37, 67, 47, 0.1)' : 'rgba(186, 26, 26, 0.1)',
                      color: (inv.status || '').toLowerCase() === 'paid' ? '#25432F' : '#BA1A1A'
                    }}>
                      {inv.status || 'Pending'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Store"
          message={'Delete ' + deleteTarget.name + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default RetailStores;
