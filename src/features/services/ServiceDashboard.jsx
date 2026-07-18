import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Briefcase } from 'lucide-react';
import { fetchServiceIncome, fetchRecurringIncome, fetchProjects } from '../../services/api';
import { fetchExpenses } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: ${({ $accent }) => $accent || '#6F240A'};
  }
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg || '#F5E6D3'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  color: ${({ $color }) => $color || '#6F240A'};
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-bottom: 0.25rem;
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 900;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatSub = styled.div`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: 0.25rem;
`;

const ChartBox = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
`;

const ChartTitle = styled.h3`
  font-size: 1rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const BarChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 200px;
  padding-top: 1rem;
`;

const Bar = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
`;

const BarFill = styled.div`
  width: 100%;
  background: ${({ $color }) => $color || '#6F240A'};
  border-radius: 4px 4px 0 0;
  height: ${({ $height }) => $height}%;
  min-height: ${({ $height }) => $height > 0 ? '4px' : '0'};
  transition: height 0.3s ease;
`;

const BarLabel = styled.span`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  white-space: nowrap;
`;

const RecentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const RecentItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: ${({ theme }) => theme.colors.background.main};
  border-radius: 8px;
  font-size: 0.9rem;
`;

const RecentLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  .name { font-weight: 600; }
  .meta { font-size: 0.75rem; color: ${({ theme }) => theme.colors.text.muted}; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.9rem;
`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ServiceDashboard = () => {
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currency, setCurrency] = useState('GHS');

  useEffect(() => {
    Promise.all([
      fetchServiceIncome(),
      fetchExpenses(),
      fetchRecurringIncome(),
      fetchProjects(),
    ]).then(([i, e, r, p]) => {
      setIncome(i);
      setExpenses(e);
      setRecurring(r);
      setProjects(p);
    });
  }, []);

  const totalGross = income.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalFees = income.reduce((s, i) => s + (parseFloat(i.platformFee) || 0), 0);
  const totalNet = income.reduce((s, i) => s + (parseFloat(i.netAmount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netProfit = totalNet - totalExpenses;
  const netMargin = totalNet > 0 ? ((netProfit / totalNet) * 100).toFixed(1) : '0.0';
  const activeProjects = projects.filter(p => p.status === 'active').length;

  const monthlyRecurring = recurring
    .filter(r => r.active !== false)
    .reduce((s, r) => {
      const amt = parseFloat(r.amount) || 0;
      if (r.frequency === 'monthly') return s + amt;
      if (r.frequency === 'quarterly') return s + amt / 3;
      if (r.frequency === 'yearly') return s + amt / 12;
      return s;
    }, 0);

  // Monthly cash flow data for chart
  const monthlyData = {};
  const now = new Date();
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { income: 0, expenses: 0 };
  }

  income.forEach(i => {
    if (i.paymentDate) {
      const d = new Date(i.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].income += parseFloat(i.netAmount || i.amount || 0);
    }
  });

  expenses.forEach(e => {
    if (e.date) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].expenses += parseFloat(e.amount || 0);
    }
  });

  const chartMonths = Object.keys(monthlyData).reverse();
  const maxVal = Math.max(...Object.values(monthlyData).map(d => Math.max(d.income, d.expenses)), 1);

  const recentIncome = [...income].sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)).slice(0, 5);

  const formatAmt = (v) => `GH₵${(v || 0).toFixed(2)}`;

  return (
    <Container>
      <Title>Service Dashboard</Title>

      <StatGrid>
        <StatCard $accent="#2E7D32">
          <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={20} /></StatIcon>
          <StatLabel>Net Income</StatLabel>
          <StatValue>{formatAmt(totalNet)}</StatValue>
          <StatSub>After {formatAmt(totalFees)} in fees</StatSub>
        </StatCard>
        <StatCard $accent="#C62828">
          <StatIcon $bg="#FFEBEE" $color="#C62828"><TrendingDown size={20} /></StatIcon>
          <StatLabel>Total Expenses</StatLabel>
          <StatValue>{formatAmt(totalExpenses)}</StatValue>
          <StatSub>All categories</StatSub>
        </StatCard>
        <StatCard $accent={netProfit >= 0 ? '#1565C0' : '#E65100'}>
          <StatIcon $bg="#E3F2FD" $color="#1565C0"><TrendingUp size={20} /></StatIcon>
          <StatLabel>Net Profit</StatLabel>
          <StatValue>{formatAmt(netProfit)}</StatValue>
          <StatSub>Margin: <strong>{netMargin}%</strong></StatSub>
        </StatCard>
        <StatCard $accent="#6F240A">
          <StatIcon $bg="#F5E6D3" $color="#6F240A"><RefreshCw size={20} /></StatIcon>
          <StatLabel>Monthly Recurring</StatLabel>
          <StatValue>{formatAmt(monthlyRecurring)}</StatValue>
          <StatSub>{recurring.filter(r => r.active !== false).length} active subscription(s)</StatSub>
        </StatCard>
        <StatCard $accent="#875200">
          <StatIcon $bg="#FFF3E0" $color="#875200"><Briefcase size={20} /></StatIcon>
          <StatLabel>Active Projects</StatLabel>
          <StatValue>{activeProjects}</StatValue>
          <StatSub>of {projects.length} total</StatSub>
        </StatCard>
      </StatGrid>

      <ChartBox>
        <ChartTitle>Cash Flow — Net Income vs Expenses</ChartTitle>
        <BarChart>
          {chartMonths.map(m => {
            const d = monthlyData[m];
            const incH = (d.income / maxVal) * 100;
            const expH = (d.expenses / maxVal) * 100;
            const parts = m.split('-');
            const label = `${MONTHS[parseInt(parts[1]) - 1]} ${parts[0].slice(2)}`;
            return (
              <Bar key={m}>
                <BarFill $color="#2E7D32" $height={incH} title={`Income: ${formatAmt(d.income)}`} />
                <BarFill $color="#C62828" $height={expH} title={`Expenses: ${formatAmt(d.expenses)}`} />
                <BarLabel>{label}</BarLabel>
              </Bar>
            );
          })}
        </BarChart>
      </ChartBox>

      <ChartBox>
        <ChartTitle>Recent Income</ChartTitle>
        {recentIncome.length > 0 ? (
          <RecentList>
            {recentIncome.map(i => (
              <RecentItem key={i.id}>
                <RecentLeft>
                  <span className="name">{i.clientName || 'Client'} {i.milestoneLabel ? `— ${i.milestoneLabel}` : ''}</span>
                  <span className="meta">{i.paymentDate || ''} {i.platformTag ? `• ${i.platformTag}` : ''}</span>
                </RecentLeft>
                <span style={{ fontWeight: 700, color: '#2E7D32' }}>{formatAmt(i.netAmount || i.amount)}</span>
              </RecentItem>
            ))}
          </RecentList>
        ) : <EmptyState>No income recorded yet. Start by adding a project or income entry.</EmptyState>}
      </ChartBox>
    </Container>
  );
};

export default ServiceDashboard;
