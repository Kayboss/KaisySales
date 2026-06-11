import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Crown, CheckCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { fetchSubscriptionPlans, recordPayment, fetchUserPayments } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatCurrencyShort, getCurrencySymbol } from '../../utils/currency';

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 800;
  color: #1C1C18;
  margin: 0 0 0.25rem;
`;

const SectionDesc = styled.p`
  font-size: 0.85rem;
  color: #89726C;
  margin: 0 0 1rem;
`;

const CurrentPlanCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 2px solid ${props => props.$active ? '#6F240A' : '#F0EEE8'};
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const PlanInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const PlanDetail = styled.div``;

const PlanLabel = styled.div`
  font-weight: 900;
  font-size: 1.25rem;
  text-transform: uppercase;
  color: #1C1C18;
`;

const PlanMeta = styled.div`
  font-size: 0.8rem;
  color: #89726C;
  margin-top: 0.15rem;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'pending' ? '#875200' : '#89726C'};
  background: ${props =>
    props.$status === 'active' ? '#E8F0EC' :
    props.$status === 'pending' ? '#FFF0E0' : '#F5F5F5'};
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const ToggleLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${props => props.$active ? '#6F240A' : '#89726C'};
`;

const ToggleSwitch = styled.button`
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: ${props => props.$yearly ? '#6F240A' : '#D0C8C4'};
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.$yearly ? '27px' : '3px'};
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    transition: left 0.2s ease;
  }
`;

const SaveBadge = styled.span`
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 800;
  color: white;
  background: #25432F;
  margin-left: 0.35rem;
  vertical-align: middle;
`;

const PlanCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 2px solid ${props => props.$active ? '#6F240A' : '#F0EEE8'};
  padding: 1.5rem;
  text-align: center;
  transition: all 0.15s ease;
  position: relative;
`;

const PlanCardTitle = styled.div`
  font-size: 1.25rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #1C1C18;
`;

const PlanCardPrice = styled.div`
  font-size: 2rem;
  font-weight: 900;
  color: #6F240A;
  margin: 0.5rem 0;
`;

const FeatureList = styled.div`
  text-align: left;
  margin: 1rem 0;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.85rem;
  color: #55423D;
  border-bottom: 1px solid #F0EEE8;

  &:last-child { border-bottom: none; }
`;

const SubscribeBtn = styled.button`
  width: 100%;
  padding: 0.75rem;
  border-radius: 10px;
  border: none;
  background: ${props => props.$current ? '#F0EEE8' : '#6F240A'};
  color: ${props => props.$current ? '#89726C' : 'white'};
  font-weight: 700;
  font-size: 0.9rem;
  cursor: ${props => props.$current ? 'default' : 'pointer'};
  transition: all 0.15s ease;

  &:hover:not(:disabled) { opacity: 0.8; }
`;

const PaymentModal = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  padding: 1rem;
`;

const PaymentCard = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
`;

const PaymentForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
`;

const FormLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 700;
  color: #55423D;
`;

const FormInput = styled.input`
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #D0C8C4;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
`;

const FormSelect = styled.select`
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #D0C8C4;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  background: white;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const CancelBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #1C1C18;
  font-weight: 600;
  cursor: pointer;
`;

const PayBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: none;
  background: #6F240A;
  color: white;
  font-weight: 700;
  cursor: pointer;
`;

const ReceiptRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid #F0EEE8;
  font-size: 0.85rem;

  &:last-child { border-bottom: none; }
`;

const FEATURES = {
  free: [
    'Up to 10 sales',
    'Up to 2 invoices',
    'Up to 5 products',
    'Basic reporting',
    '3-day free trial',
  ],
  silver: [
    'Up to 50 sales per month',
    'Up to 20 invoices per month',
    'Up to 50 products',
    'Basic reports',
    'Email support',
  ],
  gold: [
    'Unlimited sales',
    'Unlimited invoices',
    'Unlimited products',
    'Advanced reports & charts',
    'Priority support',
  ],
};

const SubscriptionSettings = () => {
  const { user } = useAuthStore();
  const { subscriptionPlan, subscriptionStatus, subscriptionExpiresAt, currency } = useSettingsStore();
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPayment, setShowPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [yearly, setYearly] = useState(false);

  const getPrice = (basePrice) => yearly ? basePrice * 10 : basePrice;
  const getPeriod = () => yearly ? '/year' : '/month';
  const getDurationDays = () => yearly ? 365 : 30;

  useEffect(() => {
    fetchSubscriptionPlans().then(setPlans);
    if (user?.uid) fetchUserPayments(user.uid).then(setPayments);
  }, [user?.uid]);

  const currentPlan = subscriptionPlan || 'none';
  const currentStatus = subscriptionStatus || 'none';
  const isActive = currentStatus === 'active';
  const isTrial = currentPlan === 'free';

  const daysRemaining = subscriptionExpiresAt
    ? Math.max(0, Math.ceil((new Date(subscriptionExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handlePayment = async () => {
    if (!showPayment || !user?.uid) return;
    try {
      const amount = showPayment === 'silver' ? (yearly ? 350 : 35) : (yearly ? 750 : 75);
      await recordPayment({
        userId: user.uid,
        plan: showPayment,
        amount,
        reference: reference || null,
        paymentMethod,
      });
      const updated = await fetchUserPayments(user.uid);
      setPayments(updated);
      setShowPayment(null);
      setReference('');
    } catch (err) {
      console.error('Payment failed', err);
    }
  };

  return (
    <div>
      <Section>
        <SectionTitle>Current Plan</SectionTitle>
        <SectionDesc>Your subscription status and plan details.</SectionDesc>
        <CurrentPlanCard $active={isActive}>
          <PlanInfo>
            <Crown size={32} color={isActive ? '#6F240A' : '#89726C'} />
            <PlanDetail>
              <PlanLabel>
                {currentPlan === 'none' ? 'Free' :
                 currentPlan === 'free' ? 'Free Trial' :
                 currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </PlanLabel>
              <PlanMeta>
                {isTrial
                  ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining in trial`
                  : isActive
                    ? `Expires ${subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toLocaleDateString() : '—'}`
                    : currentPlan === 'none' ? 'No active subscription' : 'Subscription inactive'}
              </PlanMeta>
            </PlanDetail>
          </PlanInfo>
          <StatusPill $status={currentStatus}>
            {currentStatus === 'active' ? <CheckCircle size={13} /> :
             currentStatus === 'pending' ? <Clock size={13} /> : <AlertCircle size={13} />}
            {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
          </StatusPill>
        </CurrentPlanCard>
      </Section>

      <Section>
        <SectionTitle>Available Plans</SectionTitle>
        <SectionDesc>Upgrade to unlock more features.</SectionDesc>

        <ToggleRow>
          <ToggleLabel $active={!yearly}>Monthly</ToggleLabel>
          <ToggleSwitch $yearly={yearly} onClick={() => setYearly(!yearly)} />
          <ToggleLabel $active={yearly}>Yearly <SaveBadge>Save 2mo</SaveBadge></ToggleLabel>
        </ToggleRow>

        <CardGrid>
          {[
            { key: 'free', label: 'Free Trial', price: 0, period: '3 days' },
            { key: 'silver', label: 'Silver', price: 35, yearlyPrice: 350 },
            { key: 'gold', label: 'Gold', price: 75, yearlyPrice: 750 },
          ].map(p => {
            const displayPrice = p.key === 'free' ? 0 : (yearly ? p.yearlyPrice : p.price);
            const period = p.key === 'free' ? '3 days' : (yearly ? '/year' : '/month');
            return (
            <PlanCard key={p.key} $active={currentPlan === p.key && isActive}>
              <Crown size={24} color={p.key === 'gold' ? '#875200' : p.key === 'silver' ? '#6F240A' : '#89726C'} style={{ marginBottom: '0.5rem' }} />
              <PlanCardTitle>{p.label}</PlanCardTitle>
              {p.key !== 'free' ? (
                <>
                  <PlanCardPrice>{formatCurrency(displayPrice, currency)}</PlanCardPrice>
                  <div style={{ fontSize: '0.8rem', color: '#89726C', marginBottom: '0.5rem' }}>{period}</div>
                </>
              ) : (
                <div style={{ fontSize: '1.2rem', color: '#25432F', fontWeight: 700, margin: '0.5rem 0' }}>{period} free</div>
              )}
              <FeatureList>
                {(FEATURES[p.key] || []).map((f, i) => (
                  <FeatureItem key={i}>
                    <CheckCircle size={14} color="#25432F" />
                    {f}
                  </FeatureItem>
                ))}
              </FeatureList>
              <SubscribeBtn
                $current={currentPlan === p.key && isActive}
                onClick={() => p.key === 'free' ? null : setShowPayment(p.key)}
                disabled={currentPlan === p.key && isActive || p.key === 'free'}
              >
                {currentPlan === p.key && isActive ? 'Current Plan' : p.key === 'free' ? 'Starts on Sign-up' : 'Subscribe'}
              </SubscribeBtn>
            </PlanCard>
          );
        })}
        </CardGrid>
      </Section>

      {payments.length > 0 && (
        <Section>
          <SectionTitle>Payment History</SectionTitle>
          <SectionDesc>Your recent subscription payments.</SectionDesc>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #F0EEE8' }}>
            {payments.map(p => (
              <ReceiptRow key={p.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.plan.charAt(0).toUpperCase() + p.plan.slice(1)} — {formatCurrency(p.amount, currency)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#89726C' }}>
                    {p.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Manual'} {p.reference ? `· ${p.reference}` : ''}
                  </div>
                </div>
                <StatusPill $status={p.status}>
                  {p.status === 'confirmed' ? <CheckCircle size={11} /> : <Clock size={11} />}
                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </StatusPill>
              </ReceiptRow>
            ))}
          </div>
        </Section>
      )}

      {showPayment && (
        <PaymentModal onClick={() => { setShowPayment(null); setReference(''); }}>
          <PaymentCard onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CreditCard size={24} color="#6F240A" />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Subscribe to {showPayment === 'silver' ? 'Silver' : 'Gold'}</div>
                <div style={{ fontSize: '0.8rem', color: '#89726C' }}>{formatCurrency(showPayment === 'silver' ? (yearly ? 350 : 35) : (yearly ? 750 : 75), currency)}{yearly ? '/year' : '/month'}</div>
              </div>
            </div>

            <div style={{ margin: '1rem 0', padding: '0.75rem', background: '#FFF0E0', borderRadius: 8, fontSize: '0.8rem', color: '#875200' }}>
              Pay via Mobile Money to: <strong>055 123 4567</strong> (KaisySales). Enter the transaction reference below.
            </div>

            <PaymentForm>
              <div>
                <FormLabel>Payment Method</FormLabel>
                <FormSelect value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="manual">Manual (Admin will confirm)</option>
                </FormSelect>
              </div>

              {paymentMethod === 'mobile_money' && (
                <div>
                  <FormLabel>Transaction Reference</FormLabel>
                  <FormInput
                    placeholder="e.g. MTC-1234567890"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>
              )}
            </PaymentForm>

            <ModalActions>
              <CancelBtn onClick={() => { setShowPayment(null); setReference(''); }}>Cancel</CancelBtn>
              <PayBtn onClick={handlePayment}>
                {paymentMethod === 'manual' ? 'Request Activation' : 'Submit Payment'}
              </PayBtn>
            </ModalActions>
          </PaymentCard>
        </PaymentModal>
      )}
    </div>
  );
};

export default SubscriptionSettings;