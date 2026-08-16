import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Plus, Search, Tag, TrendingUp, Calendar, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchSales, createSale, updateSale, deleteSale, fetchInventory, updateInventoryItem } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { checkCreateLimit } from '../../utils/subscriptionLimits';
import { formatCurrencyShort, getCurrencySymbol, parseAmount } from '../../utils/currency';
import { sanitizeInput, sanitizeNumber } from '../../utils/sanitize';

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

  @media (max-width: 768px) {
    display: none;
  }
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

const MobileCard = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

const SaleCard = styled.div`
  background: white;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
  position: relative;
`;

const CardAccent = styled.div`
  height: 4px;
  background: #6F240A;
  width: 100%;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem 0.5rem;
`;

const ReceiptBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #6F240A;
  background: #F5EFEB;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
`;

const TimePill = styled.span`
  font-size: 0.75rem;
  color: #89726C;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const CardBody = styled.div`
  padding: 0.25rem 1rem 0.75rem;
`;

const ItemName = styled.div`
  font-size: 1.1rem;
  font-weight: 800;
  color: #1C1C18;
  margin-bottom: 0.2rem;
  line-height: 1.3;
`;

const CategoryTag = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  color: #6F240A;
  background: #F5EFEB;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.65rem;
`;

const AmountRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const AmountLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #89726C;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const AmountValue = styled.span`
  font-size: 1.2rem;
  font-weight: 900;
  color: #6F240A;
  letter-spacing: -0.3px;
`;

const CardDivider = styled.div`
  height: 1px;
  background: #F0EEE8;
  margin: 0 1rem;
`;

const CardFooterContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
`;

const PaymentTag = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => 
    props.$method === 'Mobile Money' ? '#25432F' : 
    props.$method === 'Card' ? '#875200' : '#55423D'};
  background: ${props =>
    props.$method === 'Mobile Money' ? '#E8F0EC' : 
    props.$method === 'Card' ? '#FFF0E0' : '#F0EEE8'};
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
`;

const CardActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  transition: all 0.15s ease;

  &:hover {
    background: #F5EFEB;
  }
`;

const PAGE_SIZE = 20;

const PaginationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #55423D;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const PageBtn = styled.button`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 0.5rem 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  color: ${props => props.$active ? 'white' : '#1C1C18'};
  background: ${props => props.$active ? '#6F240A' : 'white'};

  &:hover:not(:disabled) {
    background: ${props => props.$active ? '#875200' : '#F5F0EB'};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
  const { currency, subscriptionPlan } = useSettingsStore();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [saving, setSaving] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    item: '', quantity: 1, unitPrice: '', paymentMethod: 'Cash', discount: 0
  });

  const loadData = async () => {
    try {
      const [data, inv] = await Promise.all([
        fetchSales(), fetchInventory()
      ]);
      setSales(data);
      setPage(1);
      setInventoryItems(inv);
    } catch (error) {
      console.error('Failed to load data', error);
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
      const check = await checkCreateLimit(supabase, user?.uid, subscriptionPlan, 'sales');
      if (!check.allowed) {
        setLimitError(check);
        setSaving(false);
        return;
      }
    }

    const subtotal = sanitizeNumber(formData.quantity) * sanitizeNumber(formData.unitPrice);
    const discountPct = sanitizeNumber(formData.discount) || 0;
    const totalAmount = subtotal * (1 - discountPct / 100);
    
    const invMatch = inventoryItems.find(i => i.name === formData.item);
    
    const salePayload = {
      item: sanitizeInput(formData.item, 100),
      category: invMatch?.category || '',
      quantity: sanitizeNumber(formData.quantity),
      unitPrice: sanitizeNumber(formData.unitPrice),
      paymentMethod: formData.paymentMethod,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
      amount: `GH₵${totalAmount.toFixed(2)}`
    };
    
    try {
      if (isEditing) {
        await updateSale(editId, salePayload);
      } else {
        await createSale(salePayload);
      }

      // Auto-deduct from inventory if item name matches
      try {
        const inventory = await fetchInventory();
        const match = inventory.find(i => i.name.toLowerCase() === formData.item.toLowerCase());
        if (match) {
          const qty = parseInt(formData.quantity) || 1;
          const newStock = Math.max(0, (parseInt(match.stock) || 0) - qty);
          await updateInventoryItem(match.id, {
            ...match,
            stock: newStock,
            status: newStock > 5 ? 'In Stock' : newStock > 0 ? 'Low Stock' : 'Out of Stock'
          });
        }
      } catch (invErr) {
        console.warn('Inventory auto-deduct skipped:', invErr);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save sale', error);
      alert('Failed to save sale. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sale) => {
    const parsedAmt = sale.amount ? parseFloat(String(sale.amount).replace(/[^\d.-]/g, '')) : 0;
    setFormData({
      item: sale.item,
      quantity: sale.quantity || 1,
      unitPrice: sale.unitPrice || parsedAmt,
      paymentMethod: sale.paymentMethod,
      discount: 0
    });
    setEditId(sale.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteSale(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete sale', error);
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ item: '', quantity: 1, unitPrice: '', paymentMethod: 'Cash', discount: 0 });
  };

  const filteredSales = sales.filter(sale => 
    (sale.item || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (sale.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);
  const paginatedSales = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <label>Item Sold</label>
            {inventoryItems.length === 0 ? (
              <div style={{ padding: '0.75rem', background: '#FFF8F0', borderRadius: '8px', border: '1px solid #F0EEE8', fontSize: '0.9rem', color: '#55423D' }}>
                No inventory items available.{' '}
                <a href="/inventory" style={{ color: '#6F240A', fontWeight: 700 }}>Add inventory first</a>.
              </div>
            ) : (
              <select 
                required 
                value={formData.item}
                onChange={e => {
                  const selected = inventoryItems.find(i => i.name === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    item: e.target.value,
                    category: selected?.category || prev.category,
                    unitPrice: selected?.price ? parseFloat(selected.price.replace(/[^0-9.]/g, '')) : prev.unitPrice
                  }));
                }}
              >
                <option value="">-- Select an item --</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.name}>
                    {item.name} {item.stock > 0 ? `(${item.stock} in stock)` : '(out of stock)'}
                  </option>
                ))}
              </select>
            )}
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
              <label>Unit Price ({getCurrencySymbol(currency)})</label>
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
              <label>Payment Method</label>
              <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                <option value="Cash">Cash</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Card">Card</option>
              </select>
            </FormGroup>
          </FormRow>
          <FormGroup>
            <label>Total Amount ({getCurrencySymbol(currency)})</label>
            <input 
              type="text" 
              readOnly 
              value={(formData.quantity && formData.unitPrice) ? (() => {
                const sub = parseFloat(formData.quantity) * parseFloat(formData.unitPrice);
                const disc = parseFloat(formData.discount) || 0;
                return (sub * (1 - disc / 100)).toFixed(2);
              })() : '0.00'}
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
            />
          </FormGroup>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Sale" : "Save Sale")}</button>
          </ModalActions>
        </form>
      </Modal>

      <StatsGrid>
        <StatCard>
          <StatLabel>Today's Revenue</StatLabel>
          <StatValue className="data-tabular">{formatCurrencyShort(todayRevenue, currency)}</StatValue>
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
          {paginatedSales.map(sale => (
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

      <MobileCard>
        {paginatedSales.map(sale => (
          <SaleCard key={sale.id}>
            <CardAccent />
            <CardHeader>
              <ReceiptBadge>#{sale.id}</ReceiptBadge>
              <TimePill><Calendar size={11} /> {sale.time}</TimePill>
            </CardHeader>
            <CardBody>
              <ItemName>{sale.item}</ItemName>
              <CategoryTag>{sale.category}</CategoryTag>
              <AmountRow>
                <AmountLabel>Total</AmountLabel>
                <AmountValue className="data-tabular">{sale.amount}</AmountValue>
              </AmountRow>
            </CardBody>
            <CardDivider />
            <CardFooterContent>
              <PaymentTag $method={sale.paymentMethod}>{sale.paymentMethod}</PaymentTag>
              <CardActions>
                <ActionBtn onClick={() => handleEdit(sale)} style={{ color: '#6F240A' }}>
                  <Edit2 size={13} /> Edit
                </ActionBtn>
                <ActionBtn onClick={() => setDeleteTarget(sale)} style={{ color: '#BA1A1A' }}>
                  <Trash2 size={13} /> Delete
                </ActionBtn>
              </CardActions>
            </CardFooterContent>
          </SaleCard>
        ))}
      </MobileCard>

      {totalPages > 1 && (
        <PaginationRow>
          <span>{filteredSales.length} total sales</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <PageBtn disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</PageBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <PageBtn key={p} $active={p === page} onClick={() => setPage(p)}>{p}</PageBtn>
            ))}
            <PageBtn disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</PageBtn>
          </div>
        </PaginationRow>
      )}

      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Delete Sale"
          message={'Delete ' + deleteTarget.item + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          confirmLoading={deleting}
        />
      )}
    </div>
  );
};

export default DailySales;
