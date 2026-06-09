import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Package, Search, Plus, Minus, Edit2, Trash2, Download } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, fetchCategories, createCategory } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';

const PAGE_SIZE = 20;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  width: 100%;
  max-width: 400px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.soft};

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

const StockBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 0.75rem;
  font-weight: 700;
  background: ${props => props.$low ? 'rgba(186, 26, 26, 0.1)' : 'rgba(37, 67, 47, 0.1)'};
  color: ${props => props.$low ? '#BA1A1A' : '#25432F'};
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
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    filter: brightness(1.2);
  }
`;

const MobileCard = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

const InvCard = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  padding: 1rem;
  margin-bottom: 0.75rem;
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const InvCardRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.8rem;

  &:not(:last-child) {
    border-bottom: 1px solid #F0EEE8;
  }
`;

const CardLabel = styled.span`
  color: #89726C;
  font-weight: 600;
`;

const CardValue = styled.span`
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

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', category: '', stock: '', price: '', minStock: 5, newCategory: ''
  });

  const loadData = async () => {
    try {
      const data = await fetchInventory();
      setInventory(data.reverse());
      setPage(1);
      const cats = await fetchCategories('inventory');
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load inventory', error);
      setInventory(inventoryData);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    let selectedCategory = formData.category;
    
    if (selectedCategory === 'new_category' && formData.newCategory) {
      try {
        const newCat = await createCategory({ name: formData.newCategory, type: 'inventory' });
        selectedCategory = newCat.name;
        await loadData();
      } catch (err) {
        console.error('Failed to create category', err);
      }
    }

    const stockNum = parseInt(formData.stock, 10);
    const minStock = parseInt(formData.minStock) || 5;
    const itemPayload = {
      name: formData.name,
      category: selectedCategory,
      stock: stockNum,
      minStock: minStock,
      price: `GH₵${parseFloat(formData.price).toFixed(2)}`,
      status: stockNum > minStock ? 'In Stock' : stockNum > 0 ? 'Low Stock' : 'Out of Stock'
    };
    
    try {
      if (isEditing) {
        await updateInventoryItem(editId, itemPayload);
      } else {
        await createInventoryItem(itemPayload);
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save inventory item', error);
      alert('Failed to save inventory item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    const parsedPrice = item.price ? parseFloat(String(item.price).replace('GH₵', '').replace(',', '')) : 0;
    setFormData({
      name: item.name,
      category: item.category,
      stock: item.stock,
      price: parsedPrice,
      minStock: item.minStock || 5,
      newCategory: ''
    });
    setEditId(item.id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteInventoryItem(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete inventory item', error);
    }
    setDeleteTarget(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditId(null);
    setFormData({ name: '', category: '', stock: '', price: '', minStock: 5, newCategory: '' });
  };

  const adjustStock = async (item, delta) => {
    try {
      const newStock = Math.max(0, (parseInt(item.stock) || 0) + delta);
      const minStock = parseInt(item.minStock) || 5;
      await updateInventoryItem(item.id, {
        stock: newStock,
        status: newStock > minStock ? 'In Stock' : newStock > 0 ? 'Low Stock' : 'Out of Stock'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to adjust stock', error);
    }
  };

  const exportToCSV = () => {
    const headers = {
      name: 'Item Name',
      category: 'Category',
      stock: 'Stock',
      price: 'Price',
      status: 'Status',
      minStock: 'Reorder At'
    };
    const csv = convertToCSV(inventory, headers);
    downloadCSV(csv, `Inventory_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    return parseFloat(price.replace(/[^\d.]/g, '')) || 0;
  };

  const totalPages = Math.ceil(inventory.length / PAGE_SIZE);
  const filteredInventory = searchTerm
    ? inventory.filter(i => i.name?.toLowerCase().includes(searchTerm.toLowerCase()) || i.category?.toLowerCase().includes(searchTerm.toLowerCase()))
    : inventory;
  const paginated = filteredInventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalValue = paginated.reduce((sum, i) => sum + (parseInt(i.stock) || 0) * parsePrice(i.price), 0);

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Inventory</h1>
          <p style={{ color: '#55423D' }}>Manage your inventory stock.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#55423D' }}>
            Value: <strong style={{ color: '#6F240A' }}>GH₵{totalValue.toFixed(2)}</strong>
          </div>
          <ActionButton onClick={exportToCSV} style={{ background: 'white', color: '#6F240A', border: '1px solid #D0C8C4' }}>
            <Download size={18} />
            Export
          </ActionButton>
          <ActionButton onClick={() => { setIsEditing(false); setIsModalOpen(true); }}>
            <Plus size={18} />
            New Item
          </ActionButton>
        </div>
      </Header>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? "Edit Inventory Item" : "Add Inventory Item"}>
        <form onSubmit={handleSave}>
          <FormGroup>
            <label>Item Name</label>
            <input 
              type="text" 
              required 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Hand-woven Silk Scarf" 
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
              <label>Stock Quantity</label>
              <input 
                type="number" 
                required 
                min="0"
                value={formData.stock}
                onChange={e => setFormData({...formData, stock: e.target.value})}
              />
            </FormGroup>
            <FormGroup>
              <label>Min Stock (reorder alert)</label>
              <input 
                type="number" 
                min="0"
                value={formData.minStock}
                onChange={e => setFormData({...formData, minStock: e.target.value})}
                placeholder="5" 
              />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup>
              <label>Price (GH₵)</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                placeholder="0.00" 
              />
            </FormGroup>
          </FormRow>
          <ModalActions>
            <button type="button" className="cancel" onClick={closeModal}>Cancel</button>
            <button type="submit" className="save" disabled={saving}>{saving ? "Saving..." : (isEditing ? "Update Item" : "Save Item")}</button>
          </ModalActions>
        </form>
      </Modal>

      <div style={{ marginBottom: '2rem' }}>
        <SearchBar>
          <Search size={18} color="#89726C" />
          <input 
            type="text" 
            placeholder="Search by name, SKU or category..." 
            value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            style={{ border: 'none', outline: 'none', width: '100%', fontFamily: 'inherit' }}
          />
        </SearchBar>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <Table>
          <thead>
          <tr>
            <Th>Item Name</Th>
            <Th>Category</Th>
            <Th>Stock</Th>
            <Th>Price</Th>
            <Th>Status</Th>
            <Th style={{ textAlign: 'right' }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(item => (
            <tr key={item.id}>
              <Td style={{ fontWeight: 600 }}>{item.name}</Td>
              <Td>{item.category}</Td>
              <Td className="data-tabular">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button type="button" onClick={() => adjustStock(item, -1)} style={{ background: 'none', border: '1px solid #D0C8C4', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '2px', color: '#BA1A1A' }} title="Decrease"><Minus size={14} /></button>
                  <span style={{ minWidth: '24px', textAlign: 'center' }}>{item.stock}</span>
                  <button type="button" onClick={() => adjustStock(item, 1)} style={{ background: 'none', border: '1px solid #D0C8C4', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '2px', color: '#25432F' }} title="Increase"><Plus size={14} /></button>
                </div>
              </Td>
              <Td className="data-tabular" style={{ fontWeight: 600 }}>{item.price}</Td>
              <Td>
                <StockBadge $low={item.status === 'Low Stock'}>
                  {item.status}
                </StockBadge>
              </Td>
              <Td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <Edit2 size={16} color="#89726C" cursor="pointer" onClick={() => handleEdit(item)} />
                  <Trash2 size={16} color="#BA1A1A" cursor="pointer" onClick={() => setDeleteTarget(item)} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      </div>

      <MobileCard>
        {paginated.map(item => (
          <InvCard key={item.id}>
            <InvCardRow>
              <CardLabel>Item</CardLabel>
              <CardValue>{item.name}</CardValue>
            </InvCardRow>
            <InvCardRow>
              <CardLabel>Category</CardLabel>
              <CardValue style={{ fontWeight: 600 }}>{item.category}</CardValue>
            </InvCardRow>
            <InvCardRow>
              <CardLabel>Stock</CardLabel>
              <CardValue className="data-tabular">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button type="button" onClick={() => adjustStock(item, -1)} style={{ background: 'none', border: '1px solid #D0C8C4', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '2px', color: '#BA1A1A' }}><Minus size={14} /></button>
                  <span style={{ minWidth: '24px', textAlign: 'center' }}>{item.stock}</span>
                  <button type="button" onClick={() => adjustStock(item, 1)} style={{ background: 'none', border: '1px solid #D0C8C4', borderRadius: '4px', cursor: 'pointer', display: 'flex', padding: '2px', color: '#25432F' }}><Plus size={14} /></button>
                </div>
              </CardValue>
            </InvCardRow>
            <InvCardRow>
              <CardLabel>Price</CardLabel>
              <CardValue className="data-tabular">{item.price}</CardValue>
            </InvCardRow>
            <InvCardRow>
              <CardLabel>Status</CardLabel>
              <CardValue>
                <StockBadge $low={item.status === 'Low Stock'}>{item.status}</StockBadge>
              </CardValue>
            </InvCardRow>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #F0EEE8' }}>
              <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#6F240A', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}>
                <Edit2 size={14} /> Edit
              </button>
              <button onClick={() => setDeleteTarget(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#BA1A1A', fontWeight: 600, fontSize: '0.8rem', padding: 0 }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </InvCard>
        ))}
      </MobileCard>

      {totalPages > 1 && (
        <PaginationRow>
          <span>{filteredInventory.length} total items</span>
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
          title="Delete Item"
          message={'Delete ' + deleteTarget.name + '? This cannot be undone.'}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default InventoryManagement;
