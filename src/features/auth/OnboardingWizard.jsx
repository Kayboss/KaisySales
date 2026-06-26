import { useState } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { dbService } from '../../services/supabase';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import { sanitizeInput } from '../../utils/sanitize';
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
  Crown,
  CheckCircle
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

  @media (max-width: 500px) {
    padding: 1rem;
    align-items: flex-start;
    padding-top: 2rem;
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

const PlanGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const PlanCard = styled.div`
  border: 2px solid ${props => props.$selected ? '#6F240A' : '#F0EEE8'};
  background: ${props => props.$selected ? 'rgba(111, 36, 10, 0.04)' : 'white'};
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #6F240A;
  }
`;

const PlanCardTitle = styled.div`
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #1C1C18;
  margin-top: 0.5rem;
`;

const PlanCardPrice = styled.div`
  font-size: 1.5rem;
  font-weight: 900;
  color: #6F240A;
  margin: 0.35rem 0;
`;

const PlanPeriod = styled.div`
  font-size: 0.75rem;
  color: #89726C;
  margin-bottom: 0.75rem;
`;

const PlanFeatureList = styled.div`
  text-align: left;
  font-size: 0.8rem;
  color: #55423D;
`;

const PlanFeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid #F0EEE8;

  &:last-child { border-bottom: none; }
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const ToggleLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
`;

const ToggleSwitch = styled.button`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: ${props => props.$yearly ? '#6F240A' : '#D0C8C4'};
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.$yearly ? '23px' : '2px'};
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: left 0.2s ease;
  }
`;

const SaveBadge = styled.span`
  display: inline-block;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.55rem;
  font-weight: 800;
  color: white;
  background: #25432F;
  margin-left: 0.3rem;
  vertical-align: middle;
`;

const InfoBox = styled.div`
  padding: 0.75rem;
  background: #FFF0E0;
  border-radius: 8px;
  font-size: 0.8rem;
  color: #875200;
  text-align: center;
  margin-top: 0.5rem;
  word-break: break-word;
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

const PLANS = {
  free: {
    key: 'free',
    label: 'Free Trial',
    priceLabel: '3 days free',
    features: ['Up to 10 sales', 'Up to 2 invoices', 'Up to 5 products', 'Basic reporting'],
  },
  silver: {
    key: 'silver',
    label: 'Silver',
    monthlyPrice: 35,
    yearlyPrice: 350,
    features: ['Up to 100 sales/mo', 'Up to 20 invoices/mo', 'Up to 50 products', 'Email support'],
  },
  gold: {
    key: 'gold',
    label: 'Gold',
    monthlyPrice: 75,
    yearlyPrice: 750,
    features: ['Unlimited sales', 'Unlimited invoices', 'Unlimited products', 'Priority support'],
  },
};

const OnboardingWizard = () => {
  const { user, logout } = useAuthStore();
  const updateSettings = useSettingsStore(state => state.updateSettings);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    businessName: '',
    phone: '',
    location: 'Accra, Greater Accra',
    category: 'Food & Beverage',
    avatarColor: '#6F240A',
    currency: 'GHS',
    subscriptionPlan: 'free',
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

  const setPlan = (plan) => {
    setFormData(prev => ({ ...prev, subscriptionPlan: plan }));
  };

  const toggleSeed = () => {
    setFormData(prev => ({ ...prev, seedData: !prev.seedData }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step < 5) {
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

  const getDisplayPrice = (plan) => {
    if (plan.key === 'free') return null;
    return yearly ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getPeriod = (plan) => {
    if (plan.key === 'free') return '3 days';
    return yearly ? '/year' : '/month';
  };

  // Seeding helper to populate collection data for KaisySales exploration
  const seedSampleDatabase = async (uid) => {
    const promises = [];

    // 1. Seed Categories
    const categories = [
      { name: 'General' },
      { name: 'Premium' },
      { name: 'Raw Materials' },
      { name: 'Custom Orders' }
    ];
    for (const cat of categories) {
      promises.push(dbService.createUserRecord(uid, 'categories', cat));
    }

    // 2. Seed Inventory items
    const inventoryItems = [
      {
        name: 'Premium Product (Sika Futuro)',
        quantity: 12,
        unit: 'pcs',
        status: 'In Stock',
        category: 'General'
      },
      {
        name: 'Royal Special (Lome Double Weave)',
        quantity: 3,
        unit: 'pcs',
        status: 'In Stock',
        category: 'Premium'
      },
      {
        name: 'Organic Cotton Supply (Ochre Yellow)',
        quantity: 45,
        unit: 'yards',
        status: 'In Stock',
        category: 'Raw Materials'
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
        phone: '+233 24 456 7890',
        status: 'Active'
      },
      {
        name: 'City Centre Boutique',
        location: 'Kumasi, Ashanti',
        phone: '+233 20 112 2334',
        status: 'Active'
      }
    ];
    for (const store of stores) {
      promises.push(dbService.createUserRecord(uid, 'stores', store));
    }

    // 4. Seed a Sale
    const sale = {
      item: 'Premium Product (Sika Futuro)',
      category: 'General',
      quantity: 1,
      unitPrice: 380,
      amount: '380',
      paymentMethod: 'Mobile Money (MTN)',
      date: new Date().toISOString().split('T')[0]
    };
    promises.push(dbService.createUserRecord(uid, 'sales', sale));

    // 5. Seed an Expense
    const expense = {
      title: 'Raw Materials Purchase',
      category: 'Raw Materials',
      amount: 250,
      date: new Date().toISOString().split('T')[0],
      trend: 'down'
    };
    promises.push(dbService.createUserRecord(uid, 'expenses', expense));

    // 6. Seed an Invoice
    const invoice = {
      customer: 'Kofi Mensah',
      status: 'Pending',
      total: 1800,
      date: new Date().toISOString().split('T')[0],
      items: [{ name: 'Royal Special (Lome Double Weave)', price: 1800, quantity: 1 }]
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
        ownerName: sanitizeInput(formData.ownerName, 100),
        businessName: sanitizeInput(formData.businessName, 100),
        phone: sanitizeInput(formData.phone, 20),
        location: sanitizeInput(formData.location, 200),
        category: sanitizeInput(formData.category, 50),
        avatarColor: formData.avatarColor,
        currency: formData.currency,
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
  const planKeys = ['free', 'silver', 'gold'];

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
          <ProgressSegment $active={step >= 5} />
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
                <h2>Contact & Currency</h2>
                <p>Enter your telephone number, location, and preferred currency.</p>
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
                <div>
                  <Label>Preferred Currency</Label>
                  <InputWrapper>
                    <span style={{ position: 'absolute', left: '1rem', fontSize: '1rem', color: '#89726C' }}>₵</span>
                    <Select 
                      name="currency" 
                      value={formData.currency}
                      onChange={handleChange}
                      style={{ paddingLeft: '2.75rem' }}
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                      ))}
                    </Select>
                  </InputWrapper>
                </div>
              </Form>
            </div>
          )}

          {step === 4 && (
            <div>
              <StepHeader>
                <h2>Choose Your Plan</h2>
                <p>Start with a free trial and upgrade anytime, or pick a paid plan now.</p>
              </StepHeader>

              <ToggleRow>
                <ToggleLabel $active={!yearly}>Monthly</ToggleLabel>
                <ToggleSwitch $yearly={yearly} onClick={() => setYearly(!yearly)} />
                <ToggleLabel $active={yearly}>Yearly <SaveBadge>Save 2mo</SaveBadge></ToggleLabel>
              </ToggleRow>

              <PlanGrid>
                {planKeys.map(key => {
                  const p = PLANS[key];
                  const selected = formData.subscriptionPlan === key;
                  return (
                    <PlanCard key={key} $selected={selected} onClick={() => setPlan(key)}>
                      <Crown size={22} color={key === 'gold' ? '#875200' : key === 'silver' ? '#6F240A' : '#89726C'} />
                      <PlanCardTitle>{p.label}</PlanCardTitle>
                      {key === 'free' ? (
                        <PlanCardPrice style={{ fontSize: '1rem', color: '#25432F' }}>{p.priceLabel}</PlanCardPrice>
                      ) : (
                        <>
                          <PlanCardPrice>GH₵{getDisplayPrice(p)}</PlanCardPrice>
                          <PlanPeriod>{getPeriod(p)}</PlanPeriod>
                        </>
                      )}
                      <PlanFeatureList>
                        {p.features.map((f, i) => (
                          <PlanFeatureItem key={i}>
                            <CheckCircle size={11} color="#25432F" />
                            {f}
                          </PlanFeatureItem>
                        ))}
                      </PlanFeatureList>
                      {selected && key !== 'free' && (
                        <InfoBox>Pay via Mobile Money to <strong>055 088 4398</strong> (Kevin Carl Asamany). Use your business name as reference.</InfoBox>
                      )}
                    </PlanCard>
                  );
                })}
              </PlanGrid>
            </div>
          )}

          {step === 5 && (
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
            ) : step === 5 ? (
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