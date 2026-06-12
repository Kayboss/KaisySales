import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Package, ShoppingBag, Store, FileText, ChevronRight, ChevronLeft, X } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
`;

const Card = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  width: 100%;
  max-width: 480px;
  box-shadow: ${({ theme }) => theme.shadows.ambient};
  animation: slideIn 0.3s ease-out;
  overflow: hidden;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem 0;
`;

const StepBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #89726C;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #89726C;
  padding: 0.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { color: #1C1C18; }
`;

const IconCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${props => props.$bg || 'rgba(111, 36, 10, 0.08)'};
  color: ${props => props.$color || '#6F240A'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem auto 0;
`;

const Body = styled.div`
  padding: 1.5rem 2rem;
  text-align: center;
`;

const Title = styled.h2`
  font-size: 1.35rem;
  margin: 0 0 0.5rem;
  color: #1C1C18;
`;

const Description = styled.p`
  color: #55423D;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
`;

const Footer = styled.div`
  padding: 0 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Dots = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active ? '#6F240A' : '#E0D6D0'};
  transition: background 0.2s;
`;

const NavRow = styled.div`
  display: flex;
  gap: 0.75rem;
  width: 100%;
`;

const NavButton = styled.button`
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid ${props => props.$primary ? '#6F240A' : '#E0D6D0'};
  background: ${props => props.$primary ? '#6F240A' : 'white'};
  color: ${props => props.$primary ? 'white' : '#1C1C18'};

  &:hover {
    background: ${props => props.$primary ? '#875200' : '#F5F0EB'};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const DismissRow = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: #89726C;
  padding: 0;

  &:hover { color: #1C1C18; text-decoration: underline; }
`;

const STORAGE_KEY = 'kaisy_tutorial_done';

const steps = [
  {
    icon: Package,
    iconBg: 'rgba(111, 36, 10, 0.08)',
    iconColor: '#6F240A',
    title: 'Enter Your Products',
    description: 'Start by adding all your products with their quantities and prices in Inventory. Always keep stock updated when you make or receive more products.'
  },
  {
    icon: ShoppingBag,
    iconBg: 'rgba(135, 82, 0, 0.08)',
    iconColor: '#875200',
    title: 'Record Daily Sales',
    description: 'Go to Daily Sales to record single sales as they happen. Pick the product from your inventory, enter the quantity, and log the sale.'
  },
  {
    icon: Store,
    iconBg: 'rgba(37, 67, 47, 0.08)',
    iconColor: '#25432F',
    title: 'Add Retail Shops',
    description: 'To supply goods to retail shops, create a customer profile under Retail Stores. This lets you track who you supply to.'
  },
  {
    icon: FileText,
    iconBg: 'rgba(186, 26, 26, 0.08)',
    iconColor: '#BA1A1A',
    title: 'Generate Invoices',
    description: 'Create invoices for the shops you supply. Pending status means payment hasn\'t been received yet — when the shop pays, mark the invoice as Paid.'
  }
];

const TutorialModal = ({ isOpen, onClose, autoShow }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setStep(0);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleClose = () => {
    if (autoShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      onClose();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  const s = steps[step];
  const IconComponent = s.icon;
  const isLast = step === steps.length - 1;

  if (!isOpen) return null;

  return (
    <Overlay onClick={autoShow ? handleClose : undefined}>
      <Card onClick={(e) => e.stopPropagation()}>
        <TopBar>
          <StepBadge>Step {step + 1} of {steps.length}</StepBadge>
          <CloseBtn onClick={handleClose}><X size={18} /></CloseBtn>
        </TopBar>
        <Body>
          <IconCircle $bg={s.iconBg} $color={s.iconColor}>
            <IconComponent size={28} />
          </IconCircle>
          <Title>{s.title}</Title>
          <Description>{s.description}</Description>
        </Body>
        <Footer>
          <Dots>
            {steps.map((_, i) => <Dot key={i} $active={i === step} />)}
          </Dots>
          <NavRow>
            <NavButton disabled={step === 0} onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Back
            </NavButton>
            <NavButton $primary onClick={handleNext}>
              {isLast ? 'Done' : 'Next'} <ChevronRight size={16} />
            </NavButton>
          </NavRow>
          {autoShow && (
            <DismissRow onClick={handleDismiss}>Don't show this again</DismissRow>
          )}
        </Footer>
      </Card>
    </Overlay>
  );
};

export { STORAGE_KEY };
export default TutorialModal;
