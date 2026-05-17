import React, { useState } from 'react';
import styled from 'styled-components';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { Save, User, Building, Mail, Phone, CheckCircle, MapPin, Briefcase } from 'lucide-react';

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

const SettingsPage = () => {
  const { user } = useAuthStore();
  const settings = useSettingsStore();
  
  const [formData, setFormData] = useState({
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    email: settings.email,
    phone: settings.phone,
    location: settings.location,
    category: settings.category
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
          <h1 style={{ fontSize: '2rem' }}>Business Settings</h1>
          <p style={{ color: '#55423D' }}>Manage your profile and application preferences.</p>
        </div>
      </Header>

      <FormCard>
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

          <ActionButton type="submit" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </ActionButton>
        </form>
      </FormCard>
    </div>
  );
};

export default SettingsPage;
