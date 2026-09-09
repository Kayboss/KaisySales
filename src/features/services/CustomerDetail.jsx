import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { fetchCustomers, fetchServiceIncome, fetchInvoices } from '../../services/api';

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  width: fit-content;

  &:hover {
    background: ${({ theme }) => theme.colors.background.surfaceVariant};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ProfileCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
`;

const Avatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.4rem;
`;

const ProfileInfo = styled.div`
  flex: 1;
  min-width: 200px;
`;

const Name = styled.h1`
  font-size: 1.35rem;
  margin: 0 0 0.25rem;
  color: ${({ theme }) => theme.colors.text.main};
`;

const Detail = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.85rem;
  margin-top: 0.3rem;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.25rem;

  h3 {
    font-size: 0.8rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text.muted};
    text-transform: uppercase;
    margin-bottom: 0.35rem;
  }

  .value {
    font-size: 1.5rem;
    font-weight: 900;
    color: ${({ theme }) => theme.colors.primary};
  }

  .sub {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.text.muted};
    margin-top: 0.25rem;
  }
`;

const TableCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  @media (max-width: 768px) { display: none; }
`;

const Th = styled.th`
  text-align: left;
  padding: 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.9rem;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: ${props => props.$status === 'Paid' ? 'rgba(37, 67, 47, 0.1)' : 'rgba(135, 82, 0, 0.1)'};
  color: ${props => props.$status === 'Paid' ? '#25432F' : '#875200'};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.95rem;
`;

const MobileGrid = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
`;

const MobileCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1rem;
`;

const MobileRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  font-size: 0.9rem;

  span:first-child {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.8rem;
  }
`;

const fmt = (n) => `GH₵${(n || 0).toFixed(2)}`;

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [income, setIncome] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const load = async () => {
    const [c, i, inv] = await Promise.all([fetchCustomers(), fetchServiceIncome(), fetchInvoices()]);
    setCustomers(c);
    setIncome(i);
    setInvoices(inv);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const customer = customers.find(c => String(c.id) === String(id));

  if (!customer) {
    return (
      <div>
        <BackButton onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</BackButton>
        <EmptyState>Customer not found.</EmptyState>
      </div>
    );
  }

  const name = customer.name;
  const customerIncome = income.filter(i => (i.clientName || '').trim().toLowerCase() === name.trim().toLowerCase());
  const customerInvoices = invoices.filter(inv => (inv.customer || '').trim().toLowerCase() === name.trim().toLowerCase());

  const incomeRows = customerIncome.map(i => ({
    id: `ic-${i.id}`,
    date: i.paymentDate || '',
    service: i.milestoneLabel || 'Service payment',
    status: 'Paid',
    amount: parseFloat(i.netAmount || i.amount || 0),
  }));

  const invoiceRows = customerInvoices.map(inv => {
    const firstItem = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items[0].name : '';
    const isPaid = inv.status === 'paid';
    return {
      id: `inv-${inv.id}`,
      date: inv.date || '',
      service: firstItem || `Invoice #${inv.id}`,
      status: isPaid ? 'Paid' : 'Outstanding',
      amount: parseFloat(String(inv.amount).replace(/[^\d.-]/g, '')) || 0,
    };
  });

  const rows = [...incomeRows, ...invoiceRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalReceived = incomeRows.reduce((s, r) => s + r.amount, 0);
  const outstanding = invoiceRows.filter(r => r.status === 'Outstanding').reduce((s, r) => s + r.amount, 0);
  const totalBilled = invoiceRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <Header>
        <BackButton onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to Customers</BackButton>

        <ProfileCard>
          <Avatar>{(name || '?').charAt(0).toUpperCase()}</Avatar>
          <ProfileInfo>
            <Name>{name}</Name>
            {customer.company && (
              <Detail><Building2 size={14} /> {customer.company}</Detail>
            )}
            {customer.email && <Detail><Mail size={14} /> {customer.email}</Detail>}
            {customer.phone && <Detail><Phone size={14} /> {customer.phone}</Detail>}
            {customer.location && <Detail><MapPin size={14} /> {customer.location}</Detail>}
          </ProfileInfo>
        </ProfileCard>
      </Header>

      <StatRow>
        <StatCard>
          <h3>Total Received</h3>
          <div className="value">{fmt(totalReceived)}</div>
          <div className="sub">{incomeRows.length} payments</div>
        </StatCard>
        <StatCard>
          <h3>Outstanding Balance</h3>
          <div className="value" style={{ color: outstanding > 0 ? '#C62828' : '#25432F' }}>{fmt(outstanding)}</div>
          <div className="sub">{customerInvoices.filter(inv => inv.status !== 'paid').length} unpaid invoice(s)</div>
        </StatCard>
        <StatCard>
          <h3>Total Billed</h3>
          <div className="value">{fmt(totalBilled)}</div>
          <div className="sub">{customerInvoices.length} invoice(s)</div>
        </StatCard>
      </StatRow>

      <TableCard>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Service</Th>
              <Th>Status</Th>
              <Th style={{ textAlign: 'right' }}>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <Td>{r.date || '-'}</Td>
                <Td>{r.service}</Td>
                <Td><StatusBadge $status={r.status}>{r.status}</StatusBadge></Td>
                <Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.amount)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <MobileGrid>
          {rows.map(r => (
            <MobileCard key={r.id}>
              <MobileRow><span>Date</span><span>{r.date || '-'}</span></MobileRow>
              <MobileRow><span>Service</span><span><strong>{r.service}</strong></span></MobileRow>
              <MobileRow><span>Status</span><span><StatusBadge $status={r.status}>{r.status}</StatusBadge></span></MobileRow>
              <MobileRow><span>Amount</span><span><strong>{fmt(r.amount)}</strong></span></MobileRow>
            </MobileCard>
          ))}
          {rows.length === 0 && <EmptyState>No transactions yet for this customer.</EmptyState>}
        </MobileGrid>
      </TableCard>

      {rows.length === 0 && (
        <EmptyState>No income or invoices recorded for this customer yet.</EmptyState>
      )}
    </div>
  );
};

export default CustomerDetail;