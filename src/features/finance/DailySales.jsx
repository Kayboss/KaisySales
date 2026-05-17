import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Search, Tag, TrendingUp, Calendar, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchSales, createSale, updateSale, deleteSale, fetchCategories, createCategory } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};

  @media (max-width: 768px) {
    font-size: 1.35rem;
  }
`;

const SalesTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  overflow: hidden;
`;

const Th = styled.th`
  text-align: left;
  padding: 1.25rem;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.875rem;
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

const Badge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(135, 82, 0, 0.1);
  color: #875200;
  font-size: 0.75rem;
  font-weight: 700;
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
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
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

const DailySales = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formData, setFormData] = useState({
    item: '', category: '', quantity: 1, unitPrice: '', paymentMethod: 'Cash', newCategory: ''
  });

  const loadData = async () => {
    try {
      const data = await fetchSales();
      setSales(data.reverse());
      const cats = await fetchCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load sales or categories', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    let selectedCategory = formData.category;
    
    // Handle new category creation
    if (selectedCategory === 'new_category' && formData.newCategory) {
      try {
        const newCat = await createCategory({ id: Math.random().toString(), name: formData.newCategory });
        selectedCategory = newCat.name;
        await loadData(); // refresh categories
      } catch (err) {
        console.error('Failed to create category', err);
      }
    }

    const totalAmount = parseFloat(formData.quantity) * parseFloat(formData.unitPrice);
    
    const salePayload = {
      item: formData.item,
      category: selectedCategory,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      paymentMethod: formData.paymentMethod,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: `GH₵${totalAmount.toFixed(2)}`
    };
    
    try {
      if (isEditing) {
        await updateSale(editId, salePayload);
      } else {
        await createSale({ ...salePayload, id: `SA-0${Math.floor(100 + Math.random() * 900)}` });
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save sale', error);
    }
  };

  const handleEdit = (sale) => {
    setFormData({
      item: sale.item,
      category: sale.category,
      quantity: sale.quantity || 1,
      unitPrice: sale.unitPrice || parseFloat(sale.amount.replace('GH₵', '').replace(',', '')),
      paymentMethod: sale.paymentMethod,
      newCategory: ''
    });
    setEditId(sale.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteSale(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete sale', error);
      alert('Delete failed: ' + error.message);
    }
    setDeleteTarget(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ item: '', category: '', quantity: 1, unitPrice: '', paymentMethod: 'Cash', newCategory: '' });
  };

  const filteredSales = sales.filter(sale => 
    sale.item.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const todayRevenue = sales.reduce((acc, sale) => acc + parseAmount(sale.amount || sale.totalAmount), 0);
  const itemsSold = sales.reduce((acc, sale) => acc + (parseInt(sale.quantity) || 1), 0);
  
  const categoryCounts = sales.reduce((acc, sale) => {
    acc[sale.category] = (acc[sale.category] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const handleExport = () => {
    const headers = {
      date: 'Date',
      customer: 'Customer',
      item: 'Item',
      category: 'Category',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      totalAmount: 'Total Amount'
    };
    const csv = convertToCSV(sales, headers);
    downloadCSV(csv, `DailySales_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Daily Sales</h1>
          <p style={{ color: '#55423D' }}>Track your daily sales and transactions.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ActionButton onClick={handleExport} style={{ background: 'white', color: '#6F240A', border: '1px solid #6F240A' }}>
            Export CSV
          </ActionButton>
          <ActionButton onClick={() => { setIsEditing(false); setIsModalOpen(true); }}>
            <Plus size={18} />
            Add Sale
          </ActionButton>
        </div>
      </Header>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Sale" : "Record New Sale"}>
        <form onSubmit={handleSave}>
          <FormGroup>
            <label>Item Name</label>
            <input 
              type="text" 
              required 
              value={formData.item}
              onChange={e => setFormData({...formData, item: e.target.value})}
              placeholder="e.g. Kente Cloth - Royal Gold" 
            />
          </FormGroup>
          <FormGroup>
            <label>Category</label>
            <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
              <option value="new_category">+ Add New Category...</option>
            </select>
          </FormGroup>
          {formData.category === 'new_category' && (
            <FormGroup>
              <label>New Category Name</label>
              <input 
                type="text" 
                required 
                value={formData.newCategory}
                onChange={e => setFormData({...formData, newCategory: e.target.value})}
                placeholder="e.g. Handmade Goods" 
              />
            </FormGroup>
          )}
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
              <label>Payment Method</label>
              <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                <option value="Cash">Cash</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Card">Card</option>
              </select>
            </FormGroup>
          </FormRow>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save">{isEditing ? "Update Sale" : "Save Sale"}</button>
          </ModalActions>
        </form>
      </Modal>

      <StatsGrid>
        <StatCard>
          <StatLabel>Today's Revenue</StatLabel>
          <StatValue className="data-tabular">GH₵{todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</StatValue>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#25432F', fontSize: '0.75rem', fontWeight: 700 }}>
            <TrendingUp size={14} /> Live from database
          </div>
        </StatCard>
        <StatCard>
          <StatLabel>Items Sold</StatLabel>
          <StatValue className="data-tabular">{itemsSold}</StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Total units today</div>
        </StatCard>
        <StatCard>
          <StatLabel>Top Category</StatLabel>
          <StatValue style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Tag size={24} color="#6F240A" /> {topCategory}
          </StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Most frequent category</div>
        </StatCard>
      </StatsGrid>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
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
            placeholder="Search sales by ID or item name..." 
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem' }} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <SalesTable>
          <thead>
          <tr>
            <Th>Receipt ID</Th>
            <Th>Time</Th>
            <Th>Item</Th>
            <Th>Category</Th>
            <Th style={{ textAlign: 'right' }}>Amount</Th>
            <Th>Payment</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {filteredSales.map(sale => (
            <tr key={sale.id}>
              <Td style={{ color: '#55423D', fontWeight: 600 }}>{sale.id}</Td>
              <Td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#89726C' }}>
                  <Calendar size={14} />
                  {sale.time}
                </div>
              </Td>
              <Td style={{ fontWeight: 700, color: '#1C1C18' }}>{sale.item}</Td>
              <Td><Badge>{sale.category}</Badge></Td>
              <Td style={{ textAlign: 'right', fontWeight: 800, color: '#6F240A' }} className="data-tabular">
                {sale.amount}
              </Td>
              <Td style={{ color: '#55423D', fontWeight: 600 }}>{sale.paymentMethod}</Td>
              <Td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <Edit2 size={16} color="#89726C" cursor="pointer" onClick={() => handleEdit(sale)} />
                  <Trash2 size={16} color="#BA1A1A" cursor="pointer" onClick={() => setDeleteTarget(sale)} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </SalesTable>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Sale"
          message={'Delete ' + deleteTarget.item + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default DailySales;
