import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { fetchCategories, updateCategory, deleteCategory } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Save, User, Building, Mail, Phone, CheckCircle, MapPin, Briefcase, Tag, Edit2, Trash2, X, Check, Palette, Crown, DollarSign } from 'lucide-react';
import SubscriptionSettings from './SubscriptionSettings';
import { CURRENCY_OPTIONS } from '../../utils/currency';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
`;

const FormCard = styled.div`
  background: white;
  padding: 2.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  max-width: 600px;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 1rem;
    color: ${({ theme }) => theme.colors.text.muted};
    z-index: 5;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.main};
  transition: ${({ theme }) => theme.transitions.fast};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(111, 36, 10, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text.main};
  background: ${({ theme }) => theme.colors.background.main};
  transition: ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  padding: 0.875rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: none;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};
  width: 100%;
  margin-top: 2rem;

  &:hover {
    filter: brightness(1.2);
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.text.muted};
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #25432F;
  background: rgba(37, 67, 47, 0.1);
  padding: 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: 1.5rem;
  font-weight: 600;
  font-size: 0.875rem;
`;

const CatCard = styled(FormCard)`
  margin-top: 2rem;
`;

const CatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const CatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CatRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.main};
`;

const CatName = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.main};
`;

const CatActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${props => props.$danger ? '#BA1A1A' : '#89726C'};
  padding: 0.25rem;
  display: flex;
  align-items: center;
  border-radius: 4px;

  &:hover {
    background: rgba(0,0,0,0.05);
  }
`;

const EditInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 0.9rem;
  outline: none;
`;

const TypeSelect = styled.select`
  padding: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: inherit;
  font-size: 0.85rem;
  outline: none;
  background: white;
  cursor: pointer;
`;

const EmptyState = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
`;

const TypeBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: ${props =>
    props.$type === 'expense' ? 'rgba(186, 26, 26, 0.1)' :
    props.$type === 'inventory' ? 'rgba(37, 67, 47, 0.1)' :
    'rgba(111, 36, 10, 0.1)'};
  color: ${props =>
    props.$type === 'expense' ? '#BA1A1A' :
    props.$type === 'inventory' ? '#25432F' :
    '#6F240A'};
`;

const ColorGrid = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const ColorOption = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: ${props => props.$color};
  border: 3px solid ${props => props.$selected ? '#FFFFFF' : 'transparent'};
  outline: ${props => props.$selected ? `2px solid ${props.theme.colors.primary}` : 'none'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const TabsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #F0EEE8;
  margin-bottom: 2rem;
`;

const TabBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.$active ? '#6F240A' : 'transparent'};
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
`;

const avatarColors = ['#6F240A', '#875200', '#25432F', '#D4AF37', '#8E3A1F'];

const GroupLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.text.muted};
  padding: 0.75rem 0 0.25rem;

  &:first-child { padding-top: 0; }
`;

const SETTINGS_TABS = [
  { id: 'profile', label: 'Business Profile', icon: Building },
  { id: 'subscription', label: 'Subscription', icon: Crown },
];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuthStore();
  const settings = useSettingsStore();
  
  const [formData, setFormData] = useState({
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    email: settings.email,
    phone: settings.phone,
    location: settings.location,
    category: settings.category,
    avatarColor: settings.avatarColor || '#6F240A',
    currency: settings.currency || 'GHS'
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState([]);
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatType, setEditingCatType] = useState('sales');
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories', error);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const handleEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatType(cat.type || 'sales');
  };

  const handleSaveCategory = async (id) => {
    if (!editingCatName.trim()) return;
    try {
      await updateCategory(id, { name: editingCatName.trim(), type: editingCatType });
      setEditingCatId(null);
      setEditingCatName('');
      setEditingCatType('sales');
      await loadCategories();
    } catch (error) {
      console.error('Failed to update category', error);
      alert('Failed to update category: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatType('sales');
  };

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      setDeleteCatTarget(null);
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete category', error);
      alert('Failed to delete category: ' + error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      await settings.updateSettings(user.uid, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (error) {
      console.error('🔥 Failed to save settings:', error);
      alert('Could not save your settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Settings</h1>
          <p style={{ color: '#55423D' }}>Manage your profile and application preferences.</p>
        </div>
      </Header>

      <TabsRow>
        {SETTINGS_TABS.map(tab => (
          <TabBtn key={tab.id} $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={18} />
            {tab.label}
          </TabBtn>
        ))}
      </TabsRow>

      {activeTab === 'subscription' && <SubscriptionSettings />}

      {activeTab === 'profile' && <><FormCard>
        {saved && (
          <SuccessMessage>
            <CheckCircle size={18} />
            Settings saved successfully! The sidebar logo and profile details have been updated.
          </SuccessMessage>
        )}

        <form onSubmit={handleSave}>
          <FormGroup>
            <Label>Business Name</Label>
            <InputWrapper>
              <Building size={18} />
              <Input 
                type="text" 
                name="businessName" 
                value={formData.businessName} 
                onChange={handleChange}
                placeholder="e.g., My Business"
                required
              />
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Owner Name</Label>
            <InputWrapper>
              <User size={18} />
              <Input 
                type="text" 
                name="ownerName" 
                value={formData.ownerName} 
                onChange={handleChange}
                placeholder="Full Name"
                required
              />
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Business Category</Label>
            <InputWrapper>
              <Briefcase size={18} />
              <Select 
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Retail & Sales">Retail & Sales</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Services">Services</option>
              </Select>
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Contact Email</Label>
            <InputWrapper>
              <Mail size={18} />
              <Input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange}
                placeholder="business@example.com"
                required
              />
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Phone Number</Label>
            <InputWrapper>
              <Phone size={18} />
              <Input 
                type="tel" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange}
                placeholder="+233 00 000 0000"
                required
              />
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Regional Location</Label>
            <InputWrapper>
              <MapPin size={18} />
              <Select 
                name="location" 
                value={formData.location}
                onChange={handleChange}
                required
              >
                <option value="Accra, Greater Accra">Accra, Greater Accra</option>
                <option value="Kumasi, Ashanti Region">Kumasi, Ashanti Region</option>
                <option value="Tamale, Northern Region">Tamale, Northern Region</option>
                <option value="Ho, Volta Region">Ho, Volta Region</option>
                <option value="Bolgatanga, Upper East">Bolgatanga, Upper East Region</option>
                <option value="Cape Coast, Central Region">Cape Coast, Central Region</option>
                <option value="Koforidua, Eastern Region">Koforidua, Eastern Region</option>
              </Select>
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Currency</Label>
            <InputWrapper>
              <DollarSign size={18} />
              <Select
                value={formData.currency}
                onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              >
                {CURRENCY_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.symbol} - {opt.label}</option>
                ))}
              </Select>
            </InputWrapper>
          </FormGroup>

          <FormGroup>
            <Label>Theme Color</Label>
            <InputWrapper>
              <Palette size={18} />
              <div style={{ marginLeft: '2.75rem' }}>
                <ColorGrid>
                  {avatarColors.map(color => (
                    <ColorOption
                      key={color}
                      type="button"
                      $color={color}
                      $selected={formData.avatarColor === color}
                      onClick={() => setFormData(prev => ({ ...prev, avatarColor: color }))}
                    >
                      {formData.avatarColor === color && <Check size={18} />}
                    </ColorOption>
                  ))}
                </ColorGrid>
              </div>
            </InputWrapper>
          </FormGroup>

          <ActionButton type="submit" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </ActionButton>
        </form>
      </FormCard>

      <CatCard>
        <CatHeader>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Manage Categories</h2>
            <p style={{ color: '#55423D', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Edit or remove categories used across sales, expenses, and inventory.
            </p>
          </div>
        </CatHeader>

        {categories.length === 0 ? (
          <EmptyState>No categories yet. Create one from a sales, expense, or inventory form.</EmptyState>
        ) : (
          <CatList>
            {['sales', 'expense', 'inventory'].map(group => {
              const grouped = categories.filter(c => (c.type || 'sales') === group);
              if (grouped.length === 0) return null;
              return (
                <div key={group}>
                  <GroupLabel>{group} categories</GroupLabel>
                  {grouped.map(cat => (
                    <CatRow key={cat.id}>
                      {editingCatId === cat.id ? (
                        <>
                          <EditInput
                            type="text"
                            value={editingCatName}
                            onChange={e => setEditingCatName(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCategory(cat.id); if (e.key === 'Escape') handleCancelEdit(); }}
                          />
                          <TypeSelect value={editingCatType} onChange={e => setEditingCatType(e.target.value)}>
                            <option value="sales">Sales</option>
                            <option value="expense">Expense</option>
                            <option value="inventory">Inventory</option>
                          </TypeSelect>
                          <CatActions>
                            <IconBtn onClick={() => handleSaveCategory(cat.id)}><Check size={16} /></IconBtn>
                            <IconBtn onClick={handleCancelEdit}><X size={16} /></IconBtn>
                          </CatActions>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Tag size={16} color="#89726C" />
                            <CatName>{cat.name}</CatName>
                            <TypeBadge $type={cat.type || 'sales'}>{cat.type || 'sales'}</TypeBadge>
                          </div>
                          <CatActions>
                            <IconBtn onClick={() => handleEditCategory(cat)}><Edit2 size={16} /></IconBtn>
                            <IconBtn $danger onClick={() => setDeleteCatTarget(cat)}><Trash2 size={16} /></IconBtn>
                          </CatActions>
                        </>
                      )}
                    </CatRow>
                  ))}
                </div>
              );
            })}
          </CatList>
        )}
      </CatCard>

      {deleteCatTarget && (
        <ConfirmDialog
          title="Delete Category"
          message={`Delete "${deleteCatTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteCategory(deleteCatTarget.id)}
          onCancel={() => setDeleteCatTarget(null)}
        />
      )}
      </>}
    </div>
  );
};

export default SettingsPage;
