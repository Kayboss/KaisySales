import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Crown, Search, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { fetchUsersWithStats, fetchSubscriptionPlans, assignSubscription, cancelSubscription, fetchAllPayments, confirmPayment } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/currency';
import { useSettingsStore } from '../../store/settingsStore';

const TabRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const TabBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid ${props => props.$active ? '#6F240A' : '#D0C8C4'};
  background: ${props => props.$active ? '#6F240A' : 'white'};
  color: ${props => props.$active ? 'white' : '#55423D'};
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #D0C8C4;
  margin-bottom: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-sizing: border-box;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.9rem;
  background: transparent;
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);

  @media (max-width: 768px) {
    display: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
`;

const Th = styled.th`
  text-align: left;
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #89726C;
  border-bottom: 2px solid #F0EEE8;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  color: #1C1C18;
  border-bottom: 1px solid #F0EEE8;
  vertical-align: middle;
`;

const PlanBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props =>
    props.$plan === 'gold' ? '#875200' :
    props.$plan === 'silver' ? '#55423D' :
    props.$plan === 'free' ? '#25432F' : '#89726C'};
  background: ${props =>
    props.$plan === 'gold' ? '#FFF0E0' :
    props.$plan === 'silver' ? '#F0EEE8' :
    props.$plan === 'free' ? '#E8F0EC' : '#F5F5F5'};
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props =>
    props.$status === 'active' ? '#25432F' :
    props.$status === 'pending' ? '#875200' : '#BA1A1A'};
  background: ${props =>
    props.$status === 'active' ? '#E8F0EC' :
    props.$status === 'pending' ? '#FFF0E0' : '#FFE8E8'};
`;

const ActionBtn = styled.button`
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  background: ${props => props.$color || '#6F240A'};
  transition: all 0.15s ease;

  &:hover:not(:disabled) { opacity: 0.8; }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem;
  color: #89726C;
`;

const MobileCardGrid = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const SubCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  padding: 0.85rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  padding: 1rem;
`;

const ModalCard = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem;
  font-size: 1.125rem;
  color: #1C1C18;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

const ModalCancelBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #D0C8C4;
  background: white;
  color: #1C1C18;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalConfirmBtn = styled.button`
  flex: 1;
  padding: 0.75rem;
  border-radius: 10px;
  border: none;
  background: #6F240A;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PlanSelect = styled.select`
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #D0C8C4;
  font-size: 0.8rem;
  font-weight: 600;
  background: white;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 2rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const PlanCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 2px solid ${props => props.$active ? '#6F240A' : '#F0EEE8'};
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  position: relative;
`;

const PlanName = styled.div`
  font-size: 1.25rem;
  font-weight: 900;
  color: #1C1C18;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const PlanPrice = styled.div`
  font-size: 2rem;
  font-weight: 900;
  color: #6F240A;
  margin: 0.5rem 0;
`;

const PlanPeriod = styled.div`
  font-size: 0.8rem;
  color: #89726C;
`;

const PlanFeature = styled.div`
  font-size: 0.85rem;
  color: #55423D;
  padding: 0.3rem 0;
  border-bottom: 1px solid #F0EEE8;

  &:last-child { border-bottom: none; }
`;

const PaymentFeed = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #F0EEE8;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
`;

const PaymentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #F0EEE8;
  font-size: 0.8rem;

  &:last-child { border-bottom: none; }
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

const AdminSubscriptions = () => {
  const { currency } = useSettingsStore();
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState('users');
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('silver');
  const [assignYearly, setAssignYearly] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const { user } = useAuthStore();

  const loadData = async () => {
    const [u, p, pl] = await Promise.all([
      fetchUsersWithStats(),
      fetchAllPayments(),
      fetchSubscriptionPlans(),
    ]);
    setUsers(u);
    setPayments(p);
    setPlans(pl);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, []);

  const handleAssign = async () => {
    if (!assignTarget || assigning) return;
    setAssigning(true);
    try {
      const durationDays = assignYearly ? 365 : 30;
      await assignSubscription(assignTarget.id, selectedPlan, durationDays);
      await loadData();
    } catch (err) {
      console.error('Failed to assign subscription', err);
    }
    setAssigning(false);
    setAssignTarget(null);
  };

  const handleCancel = async (u) => {
    if (cancellingId) return;
    setCancellingId(u.id);
    try {
      await cancelSubscription(u.id);
      await loadData();
    } catch (err) {
      console.error('Failed to cancel subscription', err);
    }
    setCancellingId(null);
  };

  const handleConfirmPayment = async (payment) => {
    if (confirmingId) return;
    setConfirmingId(payment.id);
    try {
      await confirmPayment(payment.id, user.uid);
      await loadData();
    } catch (err) {
      console.error('Failed to confirm payment', err);
    }
    setConfirmingId(null);
  };

  const filtered = users.filter(u =>
    !search || (u.businessName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const getUserPlan = (u) => u.subscriptionPlan || 'none';
  const getUserSubStatus = (u) => u.subscriptionStatus || 'none';

  const FEATURES = {
    free: [
      'Up to 10 sales/income records',
      'Up to 2 invoices',
      'Up to 5 products',
      'Up to 5 customers',
      'Basic reporting',
      '3-day free trial',
    ],
    silver: [
      'Up to 100 sales/income records per month',
      'Up to 20 invoices per month',
      'Up to 50 products',
      'Unlimited customers',
      'Basic reports',
      'Email support',
    ],
    gold: [
      'Unlimited sales/income records',
      'Unlimited invoices',
      'Unlimited products',
      'Unlimited customers',
      'Advanced reports & charts',
      'Priority support',
    ],
  };

  return (
    <div>
      <TabRow>
        <TabBtn $active={subTab === 'users'} onClick={() => setSubTab('users')}>Users</TabBtn>
        <TabBtn $active={subTab === 'payments'} onClick={() => setSubTab('payments')}>Payments</TabBtn>
        <TabBtn $active={subTab === 'plans'} onClick={() => setSubTab('plans')}>Plans</TabBtn>
      </TabRow>

      {subTab === 'plans' && (
        <>
          <ToggleRow>
            <ToggleLabel $active={false}>Monthly</ToggleLabel>
            <ToggleSwitch $yearly={yearly} onClick={() => setYearly(!yearly)} />
            <ToggleLabel $active={true}>Yearly <SaveBadge>Save 2mo</SaveBadge></ToggleLabel>
          </ToggleRow>
          <CardGrid>
            {[
              { key: 'free', label: 'Free Trial', price: '0', period: '3 days', yearlyPrice: '0' },
              { key: 'silver', label: 'Silver', price: '35', period: '/month', yearlyPrice: '350', yearlyPeriod: '/year' },
              { key: 'gold', label: 'Gold', price: '75', period: '/month', yearlyPrice: '750', yearlyPeriod: '/year' },
            ].map(p => {
              const displayPrice = p.key === 'free' ? '0' : (yearly ? p.yearlyPrice : p.price);
              const period = p.key === 'free' ? '3 days' : (yearly ? p.yearlyPeriod : p.period);
              return (
              <PlanCard key={p.key}>
                <Crown size={24} color={p.key === 'gold' ? '#875200' : p.key === 'silver' ? '#6F240A' : '#89726C'} style={{ marginBottom: '0.5rem' }} />
                <PlanName>{p.label}</PlanName>
                {p.key !== 'free' ? (
                  <>
                    <PlanPrice>{formatCurrency(displayPrice, currency)}</PlanPrice>
                    <PlanPeriod>{period}</PlanPeriod>
                  </>
                ) : (
                  <div style={{ fontSize: '1.2rem', color: '#25432F', fontWeight: 700, margin: '0.5rem 0' }}>{p.period} free</div>
                )}
                <div style={{ margin: '1rem 0', textAlign: 'left' }}>
                  {(FEATURES[p.key] || []).map((f, i) => (
                    <PlanFeature key={i}>{f}</PlanFeature>
                  ))}
                </div>
              </PlanCard>
              );
            })}
          </CardGrid>
        </>
      )}

      {subTab === 'payments' && (
        <>
          {payments.length === 0 ? (
            <Empty>No payments recorded yet.</Empty>
          ) : (
            <PaymentFeed>
              {payments.map(p => (
                <PaymentItem key={p.id}>
                  <DollarSign size={16} color="#6F240A" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {p.userEmail || `User ${(p.userId || '').slice(0, 8)}`} — {formatCurrency(p.amount, currency)} ({p.plan})
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#89726C', marginTop: '0.15rem' }}>
                      {p.paymentMethod} {p.reference ? `· Ref: ${p.reference}` : ''} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <StatusBadge $status={p.status}>
                    {p.status === 'confirmed' ? <CheckCircle size={11} /> : p.status === 'pending' ? <Clock size={11} /> : <XCircle size={11} />}
                    {p.status}
                  </StatusBadge>
                  {p.status === 'pending' && (
                    <ActionBtn disabled={confirmingId === p.id} onClick={() => handleConfirmPayment(p)}>
                      {confirmingId === p.id ? '...' : 'Confirm'}
                    </ActionBtn>
                  )}
                </PaymentItem>
              ))}
            </PaymentFeed>
          )}
        </>
      )}

      {subTab === 'users' && (
        <>
          <SearchBar>
            <Search size={18} color="#89726C" />
            <SearchInput placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </SearchBar>

          {filtered.length === 0 ? (
            <Empty>{search ? 'No users match your search.' : 'No users found.'}</Empty>
          ) : (
            <>
              <TableWrapper>
                <Table>
                  <thead>
                    <tr>
                      <Th>User</Th>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th>Expires</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => {
                      const plan = getUserPlan(u);
                      const subStatus = getUserSubStatus(u);
                      return (
                        <tr key={u.id}>
                          <Td>
                            <div style={{ fontWeight: 700 }}>{u.ownerName || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#89726C' }}>{u.businessName || u.email || '—'}</div>
                          </Td>
                          <Td>
                            <PlanBadge $plan={plan}>
                              {plan === 'gold' || plan === 'silver' ? <Crown size={11} /> : null}
                              {plan === 'none' ? 'None' : plan === 'free' ? 'Free Trial' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                            </PlanBadge>
                          </Td>
                          <Td>
                            <StatusBadge $status={subStatus === 'active' ? 'active' : subStatus === 'pending' ? 'pending' : 'expired'}>
                              {subStatus === 'active' ? <CheckCircle size={11} /> : <Clock size={11} />}
                              {subStatus}
                            </StatusBadge>
                          </Td>
                          <Td>
                            <span style={{ fontSize: '0.8rem', color: '#55423D' }}>
                              {u.subscriptionExpiresAt
                                ? new Date(u.subscriptionExpiresAt).toLocaleDateString()
                                : '—'}
                            </span>
                          </Td>
                          <Td>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <ActionBtn onClick={() => { setAssignTarget(u); setSelectedPlan('silver'); }}>
                              {plan === 'none' || plan === 'free' ? 'Assign' : 'Change'}
                            </ActionBtn>
                            {plan !== 'none' && plan !== 'free' && (
                              <ActionBtn $color="#BA1A1A" disabled={cancellingId === u.id} onClick={() => handleCancel(u)}>
                                {cancellingId === u.id ? '...' : 'Remove'}
                              </ActionBtn>
                            )}
                          </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrapper>

              <MobileCardGrid>
                {filtered.map(u => {
                  const plan = getUserPlan(u);
                  const subStatus = getUserSubStatus(u);
                  const planLabel = plan === 'none' ? 'None' : plan === 'free' ? 'Free Trial' : plan.charAt(0).toUpperCase() + plan.slice(1);
                  return (
                    <SubCard key={u.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1C1C18' }}>{u.ownerName || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#89726C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.businessName || u.email || '—'}</div>
                        </div>
                        <PlanBadge $plan={plan} style={{ flexShrink: 0, marginLeft: '0.5rem' }}>
                          {plan === 'gold' || plan === 'silver' ? <Crown size={11} /> : null}
                          {planLabel}
                        </PlanBadge>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                        <StatusBadge $status={subStatus === 'active' ? 'active' : subStatus === 'pending' ? 'pending' : 'expired'}>
                          {subStatus === 'active' ? <CheckCircle size={11} /> : <Clock size={11} />}
                          {subStatus}
                        </StatusBadge>
                        <span style={{ fontSize: '0.75rem', color: '#55423D' }}>
                          Expires: {u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <ActionBtn onClick={() => { setAssignTarget(u); setSelectedPlan('silver'); }} style={{ flex: 1 }}>
                          {plan === 'none' || plan === 'free' ? 'Assign' : 'Change'}
                        </ActionBtn>
                        {plan !== 'none' && plan !== 'free' && (
                          <ActionBtn $color="#BA1A1A" disabled={cancellingId === u.id} onClick={() => handleCancel(u)} style={{ flex: 1 }}>
                            {cancellingId === u.id ? 'Removing...' : 'Remove'}
                          </ActionBtn>
                        )}
                      </div>
                    </SubCard>
                  );
                })}
              </MobileCardGrid>
            </>
          )}
        </>
      )}

      {assignTarget && (
        <Overlay onClick={() => setAssignTarget(null)}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <ModalTitle>Assign Plan — {assignTarget.ownerName || assignTarget.businessName || 'User'}</ModalTitle>
            <p style={{ marginBottom: '0.75rem', color: '#55423D', fontSize: '0.875rem' }}>Select a subscription plan:</p>
            <PlanSelect value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} style={{ width: '100%' }}>
              {plans.map(p => {
                const price = assignYearly && p.name !== 'free' ? (p.name === 'silver' ? 350 : p.name === 'gold' ? 750 : p.price) : p.price;
                return (
                  <option key={p.name} value={p.name}>{p.name.charAt(0).toUpperCase() + p.name.slice(1)} — {formatCurrency(price, currency)}{assignYearly && p.name !== 'free' ? '/yr' : p.name === 'free' ? '' : '/mo'}</option>
                );
              })}
            </PlanSelect>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: assignYearly ? '#89726C' : '#6F240A' }}>Monthly</span>
              <button
                type="button"
                onClick={() => setAssignYearly(!assignYearly)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: assignYearly ? '#6F240A' : '#D0C8C4',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: assignYearly ? '23px' : '3px',
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s'
                }} />
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: assignYearly ? '#6F240A' : '#89726C' }}>Yearly</span>
            </div>
            <ModalActions>
              <ModalCancelBtn disabled={assigning} onClick={() => setAssignTarget(null)}>Cancel</ModalCancelBtn>
              <ModalConfirmBtn disabled={assigning} onClick={handleAssign}>{assigning ? 'Assigning...' : 'Assign'}</ModalConfirmBtn>
            </ModalActions>
          </ModalCard>
        </Overlay>
      )}
    </div>
  );
};

export default AdminSubscriptions;