import { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { dbService } from '../../services/phpBackend';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Building, 
  Phone, 
  MapPin, 
  Check, 
  Briefcase, 
  Compass, 
  Database 
} from 'lucide-react';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.background.main};
  position: relative;
  overflow: hidden;
  padding: 2rem;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(${({ theme }) => theme.colors.primary} 1px, transparent 1px);
    background-size: 24px 24px;
    opacity: 0.05;
    z-index: 1;
  }
`;

const WizardCard = styled.div`
  background: white;
  width: 100%;
  max-width: 650px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.ambient};
  position: relative;
  z-index: 2;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const TopProgressBar = styled.div`
  display: flex;
  height: 6px;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
`;

const ProgressSegment = styled.div`
  flex: 1;
  background: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.background.surfaceVariant};
  transition: background 0.3s ease;
`;

const Content = styled.div`
  padding: 3rem;
  flex: 1;

  @media (max-width: 500px) {
    padding: 1.5rem;
  }
`;

const StepHeader = styled.div`
  margin-bottom: 2rem;
  
  h2 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    color: ${({ theme }) => theme.colors.primary};
  }

  p {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.95rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.85rem;
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
  appearance: none;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
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

const CategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const CategoryOption = styled.div`
  border: 2px solid ${props => props.$selected ? props.theme.colors.primary : props.theme.colors.outlineVariant};
  background: ${props => props.$selected ? 'rgba(111, 36, 10, 0.04)' : 'white'};
  padding: 1.25rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 600;
  color: ${props => props.$selected ? props.theme.colors.primary : props.theme.colors.text.main};
  transition: ${({ theme }) => theme.transitions.default};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const OptionDescription = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  
  span:first-child {
    font-size: 0.95rem;
  }
  
  span:last-child {
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.text.muted};
    font-weight: normal;
  }
`;

const SeedCard = styled.div`
  border: 2px solid ${props => props.$selected ? props.theme.colors.primary : props.theme.colors.outlineVariant};
  background: ${props => props.$selected ? 'rgba(111, 36, 10, 0.04)' : 'white'};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  transition: ${({ theme }) => theme.transitions.default};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const SeedCheckCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${props => props.$selected ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$selected ? props.theme.colors.primary : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-top: 0.15rem;
  flex-shrink: 0;
`;

const Footer = styled.div`
  padding: 2rem 3rem;
  border-top: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  display: flex;
  justify-content: space-between;

  @media (max-width: 500px) {
    padding: 1.5rem;
  }
`;

const BackButton = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  color: ${({ theme }) => theme.colors.text.muted};
  padding: 0.875rem 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: white;
    color: ${({ theme }) => theme.colors.primary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const NextButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  padding: 0.875rem 1.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    filter: brightness(1.2);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.text.muted};
    cursor: not-allowed;
  }
`;

const OnboardingWizard = () => {
  const { user, logout } = useAuthStore();
  const updateSettings = useSettingsStore(state => state.updateSettings);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    businessName: '',
    phone: '',
    location: 'Accra, Greater Accra',
    category: 'Food & Beverage',
    avatarColor: '#6F240A',
    seedData: true
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setCategory = (cat) => {
    setFormData(prev => ({ ...prev, category: cat }));
  };

  const setColor = (col) => {
    setFormData(prev => ({ ...prev, avatarColor: col }));
  };

  const toggleSeed = () => {
    setFormData(prev => ({ ...prev, seedData: !prev.seedData }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Seeding helper to populate collection data for KaisySales exploration
  const seedSampleDatabase = async (uid) => {
    const promises = [];

    // 1. Seed Categories
    const categories = [
      { name: 'General', slug: 'general' },
      { name: 'Premium', slug: 'premium' },
      { name: 'Raw Materials', slug: 'raw-materials' },
      { name: 'Custom Orders', slug: 'custom-orders' }
    ];
    for (const cat of categories) {
      promises.push(dbService.createUserRecord(uid, 'categories', cat));
    }

    // 2. Seed Inventory items
    const inventoryItems = [
      {
        name: 'Premium Product (Sika Futuro)',
        sku: 'PRM-SF-01',
        quantity: 12,
        price: 380,
        category: 'General',
        description: 'High-quality product with premium finish and elegant presentation.'
      },
      {
        name: 'Royal Special (Lome Double Weave)',
        sku: 'SPC-LM-04',
        quantity: 3,
        price: 1800,
        category: 'Premium',
        description: 'Elite quality item for special occasions and ceremonies.'
      },
      {
        name: 'Organic Cotton Supply (Ochre Yellow)',
        sku: 'RWM-YL-15',
        quantity: 45,
        price: 25,
        category: 'Raw Materials',
        description: 'Premium organic raw materials for production.'
      }
    ];
    for (const item of inventoryItems) {
      promises.push(dbService.createUserRecord(uid, 'inventory', item));
    }

    // 3. Seed Retail Stores
    const stores = [
      {
        name: 'Main Street Market Stall A-12',
        location: 'Central Accra',
        contact: '+233 24 456 7890',
        active: true
      },
      {
        name: 'City Centre Boutique',
        location: 'Kumasi, Ashanti',
        contact: '+233 20 112 2334',
        active: true
      }
    ];
    for (const store of stores) {
      promises.push(dbService.createUserRecord(uid, 'stores', store));
    }

    // 4. Seed a Sale
    const sale = {
      items: [
        { name: 'Premium Product (Sika Futuro)', price: 380, quantity: 1 }
      ],
      total: 380,
      paymentMethod: 'Mobile Money (MTN)',
      customerName: 'Ama Serwah',
      customerPhone: '+233 55 987 6543',
      date: new Date().toISOString()
    };
    promises.push(dbService.createUserRecord(uid, 'sales', sale));

    // 5. Seed an Expense
    const expense = {
      category: 'Raw Materials',
      amount: 250,
      description: 'Purchased premium raw materials from local supplier.',
      date: new Date().toISOString(),
      status: 'Paid'
    };
    promises.push(dbService.createUserRecord(uid, 'expenses', expense));

    // 6. Seed an Invoice
    const invoice = {
      invoiceNumber: 'INV-2026-001',
      customerName: 'Kofi Mensah',
      customerEmail: 'kofi.mensah@gmail.com',
      items: [
        { name: 'Royal Special (Lome Double Weave)', price: 1800, quantity: 1 }
      ],
      total: 1800,
      status: 'Pending',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };
    promises.push(dbService.createUserRecord(uid, 'invoices', invoice));

    // Run all seed queries concurrently
    await Promise.all(promises);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const finalProfile = {
        ownerName: formData.ownerName,
        businessName: formData.businessName,
        phone: formData.phone,
        location: formData.location,
        category: formData.category,
        avatarColor: formData.avatarColor,
        email: user.email,
        isOnboarded: true
      };
      
      // Seed database and save profile concurrently to eliminate finalization lag
      await Promise.all([
        formData.seedData ? seedSampleDatabase(user.uid) : Promise.resolve(),
        updateSettings(user.uid, finalProfile)
      ]);
    } catch (error) {
      console.error('🔥 Onboarding submit failed:', error);
      alert('Could not save your profile details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    if (step === 1) return formData.ownerName.trim().length > 2;
    if (step === 2) return formData.businessName.trim().length > 2;
    if (step === 3) return formData.phone.trim().length > 7;
    return true;
  };

  const avatarColors = ['#6F240A', '#875200', '#25432F', '#D4AF37', '#8E3A1F'];

  return (
    <Container>
      <WizardCard>
        <div style={{ position: 'absolute', right: '1.5rem', top: '1rem', zIndex: 10 }}>
          <button 
            type="button"
            onClick={logout}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#55423D', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Sign Out
          </button>
        </div>
        <TopProgressBar style={{ marginTop: '2.5rem' }}>
          <ProgressSegment $active={step >= 1} />
          <ProgressSegment $active={step >= 2} />
          <ProgressSegment $active={step >= 3} />
          <ProgressSegment $active={step >= 4} />
        </TopProgressBar>

        <Content>
          {step === 1 && (
            <div>
              <StepHeader>
                <h2>Welcome to KaisySales</h2>
                <p>Let's begin by introducing yourself. This helps personalize your financial ledger.</p>
              </StepHeader>
              <Form onSubmit={handleNext}>
                <div>
                  <Label>Owner Full Name</Label>
                  <InputWrapper>
                    <User size={18} />
                    <Input 
                      type="text" 
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      placeholder="e.g. Kwame Osei" 
                      required 
                      autoFocus
                    />
                  </InputWrapper>
                </div>
                <div>
                  <Label>Select Profile Aesthetic Color</Label>
                  <ColorGrid>
                    {avatarColors.map(color => (
                      <ColorOption 
                        key={color}
                        type="button"
                        $color={color}
                        $selected={formData.avatarColor === color}
                        onClick={() => setColor(color)}
                      >
                        {formData.avatarColor === color && <Check size={18} />}
                      </ColorOption>
                    ))}
                  </ColorGrid>
                </div>
              </Form>
            </div>
          )}

          {step === 2 && (
            <div>
              <StepHeader>
                <h2>Business Profile</h2>
                <p>What is the name of your enterprise, and which craft do you specialize in?</p>
              </StepHeader>
              <Form onSubmit={handleNext}>
                <div>
                  <Label>Business Name</Label>
                  <InputWrapper>
                    <Building size={18} />
                    <Input 
                      type="text" 
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="e.g. Accra Craft Collective" 
                      required 
                      autoFocus
                    />
                  </InputWrapper>
                </div>
                <div>
                  <Label>Business Category</Label>
                  <CategoryGrid>
                    {[
                      { name: 'Food & Beverage', desc: 'Juices, pastries, cereals & more' },
                      { name: 'Retail & Sales', desc: 'General merchandise & products' },
                      { name: 'Agriculture', desc: 'Farming, produce & supplies' },
                      { name: 'Services', desc: 'Consulting, logistics & other' }
                    ].map(cat => (
                      <CategoryOption 
                        key={cat.name}
                        $selected={formData.category === cat.name}
                        onClick={() => setCategory(cat.name)}
                      >
                        <Briefcase size={20} />
                        <OptionDescription>
                          <span>{cat.name}</span>
                          <span>{cat.desc}</span>
                        </OptionDescription>
                      </CategoryOption>
                    ))}
                  </CategoryGrid>
                </div>
              </Form>
            </div>
          )}

          {step === 3 && (
            <div>
              <StepHeader>
                <h2>Contact & Origin</h2>
                <p>Enter your telephone number and regional location to configure local currencies and taxes.</p>
              </StepHeader>
              <Form onSubmit={handleNext}>
                <div>
                  <Label>Telephone Number</Label>
                  <InputWrapper>
                    <Phone size={18} />
                    <Input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. +233 24 412 3456" 
                      required 
                      autoFocus
                    />
                  </InputWrapper>
                </div>
                <div>
                  <Label>Regional Location</Label>
                  <InputWrapper>
                    <MapPin size={18} />
                    <Select 
                      name="location" 
                      value={formData.location}
                      onChange={handleChange}
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
                </div>
              </Form>
            </div>
          )}

          {step === 4 && (
            <div>
              <StepHeader>
                <h2>A Fresh Start</h2>
                <p>We are ready to build your financial workshop. Choose how you want to configure your database.</p>
              </StepHeader>
              <Form onSubmit={handleNext}>
                <SeedCard 
                  $selected={formData.seedData === false}
                  onClick={toggleSeed}
                >
                  <SeedCheckCircle $selected={formData.seedData === false}>
                    {formData.seedData === false && <Check size={14} />}
                  </SeedCheckCircle>
                  <OptionDescription>
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#6F240A' }}>
                      Pristine Fresh Start (Recommended)
                    </span>
                    <span style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                      Start with a completely empty, secure ledger. Perfect for entering your actual business records, daily sales, and actual inventory right away.
                    </span>
                  </OptionDescription>
                </SeedCard>

                <SeedCard 
                  $selected={formData.seedData === true}
                  onClick={toggleSeed}
                >
                  <SeedCheckCircle $selected={formData.seedData === true}>
                    {formData.seedData === true && <Check size={14} />}
                  </SeedCheckCircle>
                  <OptionDescription>
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#6F240A' }}>
                      Pre-populate with Sample Data
                    </span>
                    <span style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                      Seed your account with sample products, store partners, and sample sales. Highly recommended for a quick demo!
                    </span>
                  </OptionDescription>
                </SeedCard>
              </Form>
            </div>
          )}
        </Content>

        <Footer>
          <BackButton 
            type="button"
            onClick={handleBack} 
            disabled={step === 1 || loading}
          >
            <ArrowLeft size={16} />
            Back
          </BackButton>
          
          <NextButton 
            type="button" 
            onClick={handleNext}
            disabled={!isStepValid() || loading}
          >
            {loading ? (
              'Setting up your workspace...'
            ) : step === 4 ? (
              <>
                Open KaisySales
                <Sparkles size={16} />
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </NextButton>
        </Footer>
      </WizardCard>
    </Container>
  );
};

export default OnboardingWizard;
