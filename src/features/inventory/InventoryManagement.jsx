import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Package, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, fetchCategories, createCategory } from '../../services/api';

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

const inventoryData = [
  { id: '1', name: 'Hand-woven Silk Scarf', category: 'Textiles', stock: 12, price: 'GH₵15,000.00', status: 'In Stock' },
  { id: '2', name: 'Terracotta Vase (Large)', category: 'Ceramics', stock: 3, price: 'GH₵22,500.00', status: 'Low Stock' },
  { id: '3', name: 'Hand-carved Mask', category: 'Decor', stock: 45, price: 'GH₵8,000.00', status: 'In Stock' },
  { id: '4', name: 'Indigo Dye Pack', category: 'Materials', stock: 2, price: 'GH₵3,500.00', status: 'Low Stock' },
];

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
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    name: '', category: '', stock: '', price: '', newCategory: ''
  });

  const loadData = async () => {
    try {
      const data = await fetchInventory();
      setInventory(data.reverse());
      const cats = await fetchCategories();
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
    let selectedCategory = formData.category;
    
    if (selectedCategory === 'new_category' && formData.newCategory) {
      try {
        const newCat = await createCategory({ name: formData.newCategory });
        selectedCategory = newCat.name;
        await loadData();
      } catch (err) {
        console.error('Failed to create category', err);
      }
    }

    const stockNum = parseInt(formData.stock, 10);
    const itemPayload = {
      name: formData.name,
      category: selectedCategory,
      stock: stockNum,
      price: `GH₵${parseFloat(formData.price).toFixed(2)}`,
      status: stockNum > 5 ? 'In Stock' : 'Low Stock'
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
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name,
      category: item.category,
      stock: item.stock,
      price: parseFloat(item.price.replace('GH₵', '').replace(',', '')),
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
    setFormData({ name: '', category: '', stock: '', price: '', newCategory: '' });
  };

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Inventory</h1>
          <p style={{ color: '#55423D' }}>Manage your inventory stock.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
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
            <button type="submit" className="save">{isEditing ? "Update Item" : "Save Item"}</button>
          </ModalActions>
        </form>
      </Modal>

      <div style={{ marginBottom: '2rem' }}>
        <SearchBar>
          <Search size={18} color="#89726C" />
          <input 
            type="text" 
            placeholder="Search by name, SKU or category..." 
            style={{ border: 'none', outline: 'none', width: '100%', fontInherit: true }}
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
          {inventory.map(item => (
            <tr key={item.id}>
              <Td style={{ fontWeight: 600 }}>{item.name}</Td>
              <Td>{item.category}</Td>
              <Td className="data-tabular">{item.stock}</Td>
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
