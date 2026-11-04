import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Plus, Search, Tag, TrendingUp, Calendar, Ban } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import AssistantDoorway from '../../components/assistant/AssistantDoorway';
import { fetchSales, fetchInventory, recordSale, voidSale } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';
import { checkCreateLimit } from '../../utils/subscriptionLimits';
import { formatCurrency, formatCurrencyShort, getCurrencySymbol, parseAmount } from '../../utils/currency';
import IconAction from '../../components/ui/IconAction';
import Skeleton from '../../components/ui/Skeleton';
import SkeletonCards from '../../components/ui/SkeletonCards';
import SkeletonTable from '../../components/ui/SkeletonTable';
import SkeletonScreen from '../../components/ui/SkeletonScreen';
import { sanitizeNumber } from '../../utils/sanitize';

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
  grid-template-columns: repeat(4, 1fr);
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
  font-size: 1.5rem;
  font-weight: 600;
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
    color: ${({ theme }) => theme.colors.text.main};
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
    color: ${({ theme }) => theme.colors.text.main};
  }

  .save {
    background: ${({ theme }) => theme.colors.primary};
    border: none;
    color: white;
  }
`;

const DailySales = () => {
  const { currency, subscriptionPlan, businessRole, branches, activeBranchId } = useSettingsStore();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [voiding, setVoiding] = useState(false);
  // Cleared by the first fetch only — loadData also runs after save/delete, where a skeleton flash would be wrong.
  const [loading, setLoading] = useState(true);

  // An owner viewing "All branches" still needs one shelf to sell from; the RPC
  // has the same fallback, but showing the chosen branch makes it explicit.
  const defaultBranchId = activeBranchId
    ?? branches.find((branch) => branch.isDefault)?.id
    ?? branches[0]?.id
    ?? null;
  const showBranchPicker = businessRole === 'owner' && branches.length > 1;

  const emptyForm = () => ({
    productId: '',
    quantity: 1,
    unitPrice: '',
    paymentMethod: 'Cash',
    discount: 0,
    branchId: defaultBranchId,
  });
  const [formData, setFormData] = useState(emptyForm);

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
    loadData().finally(() => setLoading(false));
  }, []);

  const openModal = () => {
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm());
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setLimitError(null);

    const check = await checkCreateLimit(supabase, user?.uid, subscriptionPlan, 'sales');
    if (!check.allowed) {
      setLimitError(check);
      setSaving(false);
      return;
    }

    const selected = inventoryItems.find(
      (item) => String(item.productId) === String(formData.productId)
    );
    if (!selected) {
      alert('Please choose an item before saving the sale.');
      setSaving(false);
      return;
    }

    // A sale must move at least one unit. Previously the stock code fell back to
    // 1 for any unparseable or zero quantity, which invented units that were
    // never sold and quietly drained inventory.
    const quantity = sanitizeNumber(formData.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Quantity must be at least 1.');
      setSaving(false);
      return;
    }

    const unitPrice = sanitizeNumber(formData.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      alert('Unit price must be greater than 0.');
      setSaving(false);
      return;
    }

    const discountPct = sanitizeNumber(formData.discount) || 0;
    // An empty cost lets the RPC fall back to the stored per-branch cost instead
    // of recording 0, which would report the whole sale as profit.
    const rawCost = String(selected.costPrice ?? '').trim();
    const unitCost = rawCost ? parseAmount(rawCost) : null;

    try {
      const result = await recordSale({
        productId: Number(selected.productId),
        quantity,
        paymentMethod: formData.paymentMethod,
        date: new Date().toISOString().split('T')[0],
        unitPrice: String(unitPrice),
        cost: unitCost,
        branchId: formData.branchId ? Number(formData.branchId) : undefined,
        discount: discountPct,
      });

      // Stock is decremented inside the RPC under a row lock, so concurrent
      // cashiers can no longer overwrite each other's counts. It never goes
      // below zero; a shortfall is reported rather than silently invented.
      if (result?.shortfall > 0) {
        alert(`${selected.name} was short by ${result.shortfall} unit(s). Stock has been set to 0.`);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save sale', error);
      alert(error?.message || 'Failed to save sale. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      // Void, never delete: the RPC is audited, restores the stock and keeps the
      // row so history still adds up.
      await voidSale(Number(voidTarget.id), voidReason.trim());
      setVoidTarget(null);
      setVoidReason('');
      await loadData();
    } catch (error) {
      console.error('Failed to void sale', error);
      alert(error?.message || 'Could not void this sale. Please try again.');
    } finally {
      setVoiding(false);
    }
  };

  // Voided rows stay in the table for the audit trail, but they are not takings.
  const liveSales = sales.filter((sale) => !sale.voidedAt);

  const filteredSales = liveSales.filter(sale => 
    (sale.item || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (sale.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);
  const paginatedSales = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // These four cards are labelled "Today", so they must actually be scoped to
  // today. They previously summed every sale ever recorded, which made them
  // grow forever and disagree with the row list below them. Sales from previous
  // days are browsable on the Sales History page.
  const today = new Date().toISOString().split('T')[0];
  const todaySales = liveSales.filter(s => s.date === today);

  const todayRevenue = todaySales.reduce((acc, sale) => acc + parseAmount(sale.amount || sale.totalAmount), 0);
  const itemsSold = todaySales.reduce((acc, sale) => acc + (parseInt(sale.quantity) || 1), 0);
  
  const categoryCounts = todaySales.reduce((acc, sale) => {
    acc[sale.category] = (acc[sale.category] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const costByItem = {};
  inventoryItems.forEach(i => {
    costByItem[i.name] = parseAmount(i.costPrice);
  });

  const profitOf = (sale) => {
    const amt = parseAmount(sale.amount || sale.totalAmount);
    const unitCost = (sale.cost != null && sale.cost !== '')
      ? parseAmount(sale.cost)
      : (costByItem[sale.item] || 0);
    const totalCost = unitCost * (parseInt(sale.quantity) || 1);
    return amt - totalCost;
  };
  const todayProfit = todaySales.reduce((acc, sale) => acc + profitOf(sale), 0);

  const handleExport = () => {
    const headers = {
      date: 'Date',
      customer: 'Customer',
      item: 'Item',
      category: 'Category',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      cost: 'Unit Cost',
      totalAmount: 'Total Amount',
      profit: 'Profit'
    };
    const exportRows = liveSales.map(s => ({
      ...s,
      cost: (s.cost != null && s.cost !== '') ? parseAmount(s.cost) : (costByItem[s.item] || 0),
      profit: profitOf(s)
    }));
    const csv = convertToCSV(exportRows, headers);
    downloadCSV(csv, `DailySales_${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (loading) {
    return (
      <SkeletonScreen label="Loading daily sales">
        <Skeleton height="2rem" width="35%" />
        <SkeletonCards count={4} />
        <Skeleton height="3rem" width="55%" />
        <SkeletonTable rows={8} cols={8} />
      </SkeletonScreen>
    );
  }

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
          <ActionButton onClick={openModal}>
            <Plus size={18} />
            Add Sale
          </ActionButton>
        </div>
      </Header>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Record New Sale">
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
                <AssistantDoorway question="How do I record my first sale?" children="How do I record a sale?" />
              </div>
            ) : (
              <select 
                required 
                value={formData.productId}
                onChange={e => {
                  const selected = inventoryItems.find(i => String(i.productId) === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    productId: e.target.value,
                    unitPrice: selected?.price ? parseAmount(selected.price) : prev.unitPrice
                  }));
                }}
              >
                <option value="">-- Select an item --</option>
                {inventoryItems.map(item => (
                  <option key={item.productId || item.id} value={String(item.productId)}>
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
          {showBranchPicker && (
            <FormGroup>
              <label>Branch</label>
              <select
                value={formData.branchId == null ? '' : String(formData.branchId)}
                onChange={e => setFormData({
                  ...formData,
                  branchId: e.target.value === '' ? null : Number(e.target.value)
                })}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={String(branch.id)}>
                    {branch.name}{branch.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </FormGroup>
          )}
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
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : "Save Sale"}</button>
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
          <StatLabel>Today's Gross Profit</StatLabel>
          <StatValue className="data-tabular" style={{ color: todayProfit >= 0 ? '#25432F' : '#BA1A1A' }}>{formatCurrency(todayProfit, currency)}</StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Revenue minus cost of goods</div>
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
            <Th style={{ textAlign: 'right' }}>Profit</Th>
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
                {formatCurrency(sale.amount, currency)}
              </Td>
              <Td style={{ textAlign: 'right', fontWeight: 700, color: profitOf(sale) >= 0 ? '#25432F' : '#BA1A1A' }} className="data-tabular">
                {formatCurrency(profitOf(sale), currency)}
              </Td>
              <Td style={{ color: '#55423D', fontWeight: 600 }}>{sale.paymentMethod}</Td>
              <Td style={{ textAlign: 'right' }}>
                <IconAction label={`Void sale of ${sale.item}`} onClick={() => { setVoidReason(''); setVoidTarget(sale); }}>
                  <Ban size={16} color="#BA1A1A" />
                </IconAction>
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
                <AmountValue className="data-tabular">{formatCurrency(sale.amount, currency)}</AmountValue>
              </AmountRow>
              <AmountRow>
                <AmountLabel>Profit</AmountLabel>
                <AmountValue className="data-tabular" style={{ color: profitOf(sale) >= 0 ? '#25432F' : '#BA1A1A', fontSize: '1rem' }}>
                  {formatCurrency(profitOf(sale), currency)}
                </AmountValue>
              </AmountRow>
            </CardBody>
            <CardDivider />
            <CardFooterContent>
              <PaymentTag $method={sale.paymentMethod}>{sale.paymentMethod}</PaymentTag>
              <CardActions>
                <ActionBtn onClick={() => { setVoidReason(''); setVoidTarget(sale); }} style={{ color: '#BA1A1A' }}>
                  <Ban size={13} /> Void
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

      <Modal
        isOpen={!!voidTarget}
        onClose={() => { if (!voiding) { setVoidTarget(null); setVoidReason(''); } }}
        title="Void Sale"
      >
        <p style={{ color: '#55423D', marginTop: 0 }}>
          Voiding returns the units to stock and keeps the row in history for the audit trail.
          {voidTarget ? ` This void will be recorded against “${voidTarget.item}”.` : ''}
        </p>
        <FormGroup>
          <label>Reason</label>
          <input
            type="text"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. customer returned the item"
          />
        </FormGroup>
        <ModalActions>
          <button
            type="button"
            className="cancel"
            onClick={() => { setVoidTarget(null); setVoidReason(''); }}
            disabled={voiding}
          >
            Cancel
          </button>
          <button type="button" className="save" onClick={handleVoid} disabled={voiding}>
            {voiding ? 'Voiding...' : 'Void sale'}
          </button>
        </ModalActions>
      </Modal>
    </div>
  );
};

export default DailySales;
