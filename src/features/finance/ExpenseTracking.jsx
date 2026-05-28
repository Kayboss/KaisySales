import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Filter, Download, ArrowUpRight, ArrowDownRight, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchExpenses, createExpense, updateExpense, deleteExpense, fetchCategories, createCategory, fetchInvoices, fetchLargestExpenseCategory } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 3rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const CardLabel = styled.div`
  color: #55423D;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  
  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const CardValue = styled.div`
  font-size: 1.5rem;
  font-weight: 800;
  color: ${props => props.$color || '#6F240A'};
  
  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const PAGE_SIZE = 20;

const ExpenseList = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  overflow: hidden;

  @media (max-width: 768px) {
    display: none;
  }
`;

const ListItem = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const MobileCard = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

const ExpCard = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 1rem;
  margin-bottom: 0.75rem;
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const ExpCardRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.8rem;

  &:not(:last-child) {
    border-bottom: 1px solid #F0EEE8;
  }
`;

const ExpCardLabel = styled.span`
  color: #89726C;
  font-weight: 600;
`;

const ExpCardValue = styled.span`
  color: #1C1C18;
  font-weight: 700;
  text-align: right;
`;

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

const CategoryBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(135, 82, 0, 0.1);
  color: ${({ theme }) => theme.colors.secondary};
  text-transform: uppercase;
`;

const ActionButton = styled.button`
  background: ${({ theme, $variant }) => $variant === 'secondary' ? 'white' : theme.colors.primary};
  color: ${({ theme, $variant }) => $variant === 'secondary' ? theme.colors.primary : 'white'};
  border: ${({ theme, $variant }) => $variant === 'secondary' ? `1px solid ${theme.colors.outlineVariant}` : 'none'};
  padding: 0.75rem 1.25rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;

  &:hover {
    filter: brightness(1.1);
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

const ExpenseTracking = () => {
  const [expenses, setExpenses] = useState([]);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [largestCategory, setLargestCategory] = useState('N/A');

  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '', category: '', quantity: 1, unitPrice: '', date: '', newCategory: ''
  });

  const loadData = async () => {
    try {
      const [data, largestCat] = await Promise.all([
        fetchExpenses(), fetchLargestExpenseCategory()
      ]);
      setExpenses(data.reverse());
      setPage(1);
      setLargestCategory(largestCat);
      const cats = await fetchCategories('expense');
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load expenses or categories', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    let selectedCategory = formData.category;
    
    // Handle new category creation
    if (selectedCategory === 'new_category' && formData.newCategory) {
      try {
        const newCat = await createCategory({ name: formData.newCategory, type: 'expense' });
        selectedCategory = newCat.name;
        await loadData();
      } catch (err) {
        console.error('Failed to create category', err);
      }
    }

    const totalAmount = parseFloat(formData.quantity) * parseFloat(formData.unitPrice);

    const expensePayload = {
      title: formData.title,
      category: selectedCategory,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      date: formData.date,
      amount: `GH₵${totalAmount.toFixed(2)}`,
      trend: 'up' // default
    };
    
    try {
      if (isEditing) {
        await updateExpense(editId, expensePayload);
      } else {
        await createExpense(expensePayload);
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save expense', error);
      alert('Failed to save expense: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense) => {
    const parsedAmt = expense.amount ? parseFloat(String(expense.amount).replace('GH₵', '').replace(',', '')) : 0;
    setFormData({
      title: expense.title,
      category: expense.category,
      quantity: expense.quantity || 1,
      unitPrice: expense.unitPrice || parsedAmt,
      date: expense.date,
      newCategory: ''
    });
    setEditId(expense.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete expense', error);
    }
    setDeleteTarget(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ title: '', category: '', quantity: 1, unitPrice: '', date: '', newCategory: '' });
  };

  const handleExport = () => {
    const headers = {
      date: 'Date',
      description: 'Description',
      category: 'Category',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      amount: 'Total Amount'
    };
    const csv = convertToCSV(expenses, headers);
    downloadCSV(csv, `Expenses_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const totalExpenses = expenses.reduce((acc, exp) => acc + parseAmount(exp.amount), 0);
  
  const totalPages = Math.ceil(expenses.length / PAGE_SIZE);
  const paginatedExpenses = expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  
  // For pending invoices, we'll need to fetch them if we want this to be accurate, 
  // or we can show a placeholder if it's meant to be static for this module.
  // Given the user wants "live data", I'll fetch invoices too.
  const [pendingInvoices, setPendingInvoices] = useState(0);

  useEffect(() => {
    const fetchInvoiceCount = async () => {
      try {
        const invs = await fetchInvoices();
        setPendingInvoices(invs.filter(i => i.status?.toLowerCase() === 'pending').length);
      } catch (e) {
        console.error(e);
      }
    };
    fetchInvoiceCount();
  }, []);

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Expense Tracking</h1>
          <p style={{ color: '#55423D' }}>Monitor your production costs and overheads.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <ActionButton onClick={handleExport} style={{ background: 'white', color: '#6F240A', border: '1px solid #6F240A' }}>
            Export CSV
          </ActionButton>
          <ActionButton onClick={() => { setIsEditing(false); setIsModalOpen(true); }}>
            <Plus size={18} />
            Add Expense
          </ActionButton>
        </div>
      </Header>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Expense" : "Log New Expense"}>
        <form onSubmit={handleSave}>
          <FormGroup>
            <label>Expense Title</label>
            <input 
              type="text" 
              required 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Indigo Dye Procurement" 
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
                value={(formData.quantity && formData.unitPrice) ? (parseFloat(formData.quantity) * parseFloat(formData.unitPrice)).toFixed(2) : '0.00'}
                style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </FormGroup>
            <FormGroup>
              <label>Date</label>
              <input 
                type="date" 
                required 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </FormGroup>
          </FormRow>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Expense" : "Save Expense")}</button>
          </ModalActions>
        </form>
      </Modal>

      <SummaryGrid>
        <Card>
          <CardLabel>TOTAL EXPENSES</CardLabel>
          <CardValue className="data-tabular" $color="#6F240A">GH₵{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</CardValue>
          <div style={{ fontSize: '0.75rem', color: '#25432F', marginTop: '0.5rem', fontWeight: 600 }}>Live from database</div>
        </Card>
        <Card>
          <CardLabel>LARGEST CATEGORY</CardLabel>
          <CardValue $color="#875200">{largestCategory}</CardValue>
          <div style={{ fontSize: '0.75rem', color: '#25432F', marginTop: '0.5rem', fontWeight: 600 }}>Live from database</div>
        </Card>
        <Card>
          <CardLabel>PENDING INVOICES</CardLabel>
          <CardValue className="data-tabular" $color="#25432F">{pendingInvoices}</CardValue>
          <div style={{ fontSize: '0.75rem', color: '#BA1A1A', marginTop: '0.5rem', fontWeight: 600 }}>Awaiting payment</div>
        </Card>
      </SummaryGrid>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Recent Outflows</h2>
          <ActionButton $variant="secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <Filter size={16} />
            Filter
          </ActionButton>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <ExpenseList style={{ minWidth: '600px' }}>
          {paginatedExpenses.map(expense => (
            <ListItem key={expense.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: 'rgba(111, 36, 10, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: expense.trend === 'up' ? '#BA1A1A' : '#25432F',
                  flexShrink: 0
                }}>
                  {expense.trend === 'up' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#55423D' }}>{expense.date}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#6F240A', textAlign: 'left' }} className="data-tabular">
                {expense.amount}
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <Edit2 size={16} color="#89726C" cursor="pointer" onClick={() => handleEdit(expense)} />
                <Trash2 size={16} color="#BA1A1A" cursor="pointer" onClick={() => setDeleteTarget(expense)} />
              </div>
            </ListItem>
          ))}
        </ExpenseList>
      </div>

        <MobileCard>
          {paginatedExpenses.map(expense => (
            <ExpCard key={expense.id}>
              <ExpCardRow>
                <ExpCardLabel>Title</ExpCardLabel>
                <ExpCardValue>{expense.title}</ExpCardValue>
              </ExpCardRow>
              <ExpCardRow>
                <ExpCardLabel>Date</ExpCardLabel>
                <ExpCardValue>{expense.date}</ExpCardValue>
              </ExpCardRow>
              <ExpCardRow>
                <ExpCardLabel>Category</ExpCardLabel>
                <ExpCardValue style={{ fontWeight: 600 }}>{expense.category}</ExpCardValue>
              </ExpCardRow>
              <ExpCardRow>
                <ExpCardLabel>Amount</ExpCardLabel>
                <ExpCardValue style={{ color: '#6F240A', fontSize: '0.95rem' }}>{expense.amount}</ExpCardValue>
              </ExpCardRow>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #F0EEE8' }}>
                <button onClick={() => handleEdit(expense)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#6F240A', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => setDeleteTarget(expense)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#BA1A1A', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </ExpCard>
          ))}
        </MobileCard>

        {totalPages > 1 && (
          <PaginationRow>
            <span>{expenses.length} total expenses</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <PageBtn disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <PageBtn key={p} $active={p === page} onClick={() => setPage(p)}>{p}</PageBtn>
              ))}
              <PageBtn disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</PageBtn>
            </div>
          </PaginationRow>
        )}
      </section>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Expense"
          message={'Delete ' + deleteTarget.title + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default ExpenseTracking;
