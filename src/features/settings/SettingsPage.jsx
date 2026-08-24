import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { fetchCategories, createCategory, updateCategory, deleteCategory, uploadBusinessLogo, deleteBusinessLogo } from '../../services/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Save, User, Building, Mail, Phone, CheckCircle, MapPin, Briefcase, Tag, Edit2, Trash2, X, Check, Palette, Crown, DollarSign, Upload } from 'lucide-react';
import SubscriptionSettings from './SubscriptionSettings';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import { sanitizeInput } from '../../utils/sanitize';

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
  gap: 0.5rem;

  @media (max-width: 500px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const CatName = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.main};
`;

const CatActions = styled.div`
  display: flex;
  gap: 0.5rem;

  @media (max-width: 500px) {
    justify-content: flex-end;
  }
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
  min-width: 0;
`;

const EmptyState = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
`;

const ColorGrid = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;

  @media (max-width: 500px) {
    gap: 0.5rem;
  }
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

  @media (max-width: 500px) {
    width: 40px;
    height: 40px;
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

const avatarColors = ['#6F240A', '#1E3A8A', '#25432F', '#D4AF37', '#8B5E7C'];

const SETTINGS_TABS = [
  { id: 'profile', label: 'Business Profile', icon: Building },
  { id: 'subscription', label: 'Subscription', icon: Crown },
];

const SettingsPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'subscription') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('subscription');
    }
  }, [location.search]);
  const settings = useSettingsStore();
  
  const [formData, setFormData] = useState({
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    email: settings.email,
    phone: settings.phone,
    location: settings.location,
    category: settings.category,
    avatarColor: settings.avatarColor || '#6F240A',
    currency: settings.currency || 'GHS',
    logoUrl: settings.logoUrl || '',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [categories, setCategories] = useState([]);
  const [catTab, setCatTab] = useState('income');
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCat, setDeletingCat] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories', error);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCategories(); }, []);

  const filteredCategories = categories.filter(c => (c.type || 'income') === catTab);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await createCategory({ name: newCatName.trim(), type: catTab });
      setNewCatName('');
      await loadCategories();
    } catch (error) {
      console.error('Failed to create category', error);
    } finally {
      setAddingCat(false);
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleSaveCategory = async (id) => {
    if (!editingCatName.trim()) return;
    setSavingCat(true);
    try {
      await updateCategory(id, { name: sanitizeInput(editingCatName.trim(), 50) });
      setEditingCatId(null);
      setEditingCatName('');
      await loadCategories();
    } catch (error) {
      console.error('Failed to update category', error);
    } finally {
      setSavingCat(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleDeleteCategory = async (id) => {
    setDeletingCat(true);
    try {
      await deleteCategory(id);
      setDeleteCatTarget(null);
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete category', error);
    } finally {
      setDeletingCat(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB.');
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadBusinessLogo(file);
      setFormData(prev => ({ ...prev, logoUrl: url }));
      setSaved(false);
    } catch (err) {
      console.error('Logo upload failed:', err);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      await deleteBusinessLogo();
      setFormData(prev => ({ ...prev, logoUrl: '' }));
      setSaved(false);
    } catch (err) {
      console.error('Logo delete failed:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      await settings.updateSettings(user.uid, {
        ...formData,
        businessName: sanitizeInput(formData.businessName, 100),
        phone: sanitizeInput(formData.phone, 20),
        location: sanitizeInput(formData.location, 200),
      });
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
            <Label>Business Logo</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '2.75rem' }}>
              {formData.logoUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={formData.logoUrl} alt="Business logo" style={{ height: 64, maxWidth: 180, objectFit: 'contain', border: '1px solid #D0C8C4', borderRadius: 8, padding: 4, background: '#FAFAFA' }} />
                  <button type="button" disabled={uploadingLogo} onClick={handleLogoRemove} style={{ position: 'absolute', top: -8, right: -8, background: '#BA1A1A', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingLogo ? 'not-allowed' : 'pointer', fontSize: '0.75rem', opacity: uploadingLogo ? 0.5 : 1 }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px dashed #D0C8C4', borderRadius: 8, cursor: uploadingLogo ? 'not-allowed' : 'pointer', color: '#89726C', fontSize: '0.85rem', fontWeight: 600, opacity: uploadingLogo ? 0.5 : 1 }}>
                  {uploadingLogo ? 'Uploading...' : <><Upload size={16} /> Upload logo (max 2MB)</>}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <p style={{ marginLeft: '2.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#89726C' }}>Displayed on invoices. Recommended: 400×100px transparent PNG.</p>
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
                      onClick={() => {
                        setFormData(prev => ({ ...prev, avatarColor: color }));
                        settings.setAvatarColor(color);
                      }}
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
              Add or remove income and expense categories.
            </p>
          </div>
        </CatHeader>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #F0EEE8', paddingBottom: 0 }}>
          <button
            onClick={() => setCatTab('income')}
            style={{
              padding: '0.6rem 1.25rem', border: 'none', background: 'none', fontWeight: 700, fontSize: '0.85rem',
              color: catTab === 'income' ? '#6F240A' : '#89726C',
              borderBottom: catTab === 'income' ? '2px solid #6F240A' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >Income</button>
          <button
            onClick={() => setCatTab('expense')}
            style={{
              padding: '0.6rem 1.25rem', border: 'none', background: 'none', fontWeight: 700, fontSize: '0.85rem',
              color: catTab === 'expense' ? '#BA1A1A' : '#89726C',
              borderBottom: catTab === 'expense' ? '2px solid #BA1A1A' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >Expense</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
            placeholder={`New ${catTab} category...`}
            style={{ flex: 1, padding: '0.6rem 0.85rem', border: '1px solid #D0C8C4', borderRadius: 8, fontSize: '0.9rem', outline: 'none' }}
          />
          <button
            onClick={handleAddCategory}
            disabled={addingCat || !newCatName.trim()}
            style={{
              padding: '0.6rem 1.25rem', border: 'none', borderRadius: 8, background: addingCat || !newCatName.trim() ? '#997A6F' : '#6F240A',
              color: 'white', fontWeight: 600, cursor: addingCat || !newCatName.trim() ? 'not-allowed' : 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap',
            }}
          >{addingCat ? 'Adding...' : '+ Add'}</button>
        </div>

        {filteredCategories.length === 0 ? (
          <EmptyState>No {catTab} categories yet. Add one above.</EmptyState>
        ) : (
          <CatList>
            {filteredCategories.map(cat => (
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
                    <CatActions>
                      <IconBtn disabled={savingCat} onClick={() => handleSaveCategory(cat.id)} style={{ opacity: savingCat ? 0.5 : 1 }}><Check size={16} /></IconBtn>
                      <IconBtn onClick={handleCancelEdit}><X size={16} /></IconBtn>
                    </CatActions>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag size={16} color="#89726C" />
                      <CatName>{cat.name}</CatName>
                    </div>
                    <CatActions>
                      <IconBtn onClick={() => handleEditCategory(cat)}><Edit2 size={16} /></IconBtn>
                      <IconBtn $danger onClick={() => setDeleteCatTarget(cat)}><Trash2 size={16} /></IconBtn>
                    </CatActions>
                  </>
                )}
              </CatRow>
            ))}
          </CatList>
        )}
      </CatCard>

      {deleteCatTarget && (
        <ConfirmDialog
          isOpen={!!deleteCatTarget}
          title="Delete Category"
          message={`Delete "${deleteCatTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteCategory(deleteCatTarget.id)}
          onCancel={() => setDeleteCatTarget(null)}
          confirmLoading={deletingCat}
        />
      )}
      </>}
    </div>
  );
};

export default SettingsPage;
