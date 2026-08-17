import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Download, DollarSign, TrendingUp, TrendingDown, PieChart, Users, Calendar } from 'lucide-react';
import { fetchServiceIncome, fetchRecurringIncome, fetchExpenses, fetchCustomers } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Tab = styled.button`
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.outlineVariant};
  background: ${({ $active }) => $active ? '#6F240A' : 'white'};
  color: ${({ $active }) => $active ? 'white' : '#1C1C18'};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid ${({ $accent }) => $accent || '#6F240A'};
`;

const StatIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${({ $bg }) => $bg || '#F5E6D3'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  color: ${({ $color }) => $color || '#6F240A'};
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 900;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.muted};
  letter-spacing: 0.05em;
`;

const ReportSection = styled.div`
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
`;

const ReportTitle = styled.h3`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 1rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  @media (max-width: 768px) { display: none; }
`;

const Th = styled.th`
  text-align: left;
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.muted};
  border-bottom: 2px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.85rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const DateRange = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const DateInput = styled.input`
  padding: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  font-size: 0.85rem;
`;

const ExportBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  &:hover { background: ${({ theme }) => theme.colors.background.surfaceVariant}; }
`;

const PlatformTag = styled.span`
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  background: #E3F2FD;
  color: #1565C0;
`;

const SubHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
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
  height: 180px;
  padding-top: 1rem;
`;

const Bar = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
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
  font-size: 0.6rem;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  white-space: nowrap;
`;

const PieWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
`;

const PieLegend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
`;

const LegendDot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ServiceReporting = () => {
  const [tab, setTab] = useState('overview');
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    Promise.all([
      fetchServiceIncome(), fetchRecurringIncome(), fetchExpenses(),
      fetchCustomers(),
    ]).then(([i, , e, c]) => {
      setIncome(i); setExpenses(e); setCustomers(c);
    });
  }, []);

  const filterByDate = (items, dateField) =>
    items.filter(i => {
      const d = new Date(i[dateField] || 0);
      return d >= new Date(startDate) && d <= new Date(endDate + 'T23:59:59');
    });

  const filteredIncome = filterByDate(income, 'paymentDate');
  const filteredExpenses = filterByDate(expenses, 'date');

  const totalNet = filteredIncome.reduce((s, i) => s + (parseFloat(i.netAmount || i.amount) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0), 0);
  const netProfit = totalNet - totalExpenses;
  const netMargin = totalNet > 0 ? ((netProfit / totalNet) * 100).toFixed(1) : '0.0';

  const platformBreakdown = {};
  filteredIncome.forEach(i => {
    const p = i.platformTag || 'Direct';
    const amt = parseFloat(i.netAmount || i.amount) || 0;
    platformBreakdown[p] = (platformBreakdown[p] || 0) + amt;
  });

  // Monthly cash flow data for chart
  const monthlyData = {};
  const now = new Date();
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { income: 0, expenses: 0 };
  }
  filteredIncome.forEach(i => {
    if (i.paymentDate) {
      const d = new Date(i.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].income += parseFloat(i.netAmount || i.amount || 0);
    }
  });
  filteredExpenses.forEach(e => {
    if (e.date) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].expenses += parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0;
    }
  });

  const chartMonths = Object.keys(monthlyData).reverse();
  const maxVal = Math.max(...Object.values(monthlyData).map(d => Math.max(d.income, d.expenses)), 1);

  const PIE_COLORS = ['#6F240A', '#D4AF37', '#25432F', '#1E3A8A', '#8B5E7C', '#875200'];
  const platformEntries = Object.entries(platformBreakdown).sort((a, b) => b[1] - a[1]);
  const pieTotal = platformEntries.reduce((s, [, v]) => s + v, 0);

  const formatAmt = (v) => `GH₵${(v || 0).toFixed(2)}`;

  const exportReport = () => {
    const headers = { date: 'Date', client: 'Client', service: 'Service', gross: 'Gross Amount', fee: 'Platform Fee', net: 'Net Amount' };
    const rows = filteredIncome.map(i => ({
      date: i.paymentDate || '',
      client: i.clientName || '',
      service: i.milestoneLabel || i.description || '',
      gross: formatAmt(i.amount),
      fee: formatAmt(i.platformFee),
      net: formatAmt(i.netAmount || i.amount),
    }));
    const csv = convertToCSV(rows, headers);
    downloadCSV(csv, `IncomeReport_${startDate}_to_${endDate}.csv`);
  };

  const renderOverview = () => (
    <>
      <StatGrid>
        <StatCard $accent="#2E7D32">
          <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={18} /></StatIcon>
          <StatLabel>Net Income</StatLabel>
          <StatValue>{formatAmt(totalNet)}</StatValue>
        </StatCard>
        <StatCard $accent="#C62828">
          <StatIcon $bg="#FFEBEE" $color="#C62828"><TrendingDown size={18} /></StatIcon>
          <StatLabel>Expenses</StatLabel>
          <StatValue>{formatAmt(totalExpenses)}</StatValue>
        </StatCard>
        <StatCard $accent={netProfit >= 0 ? '#1565C0' : '#E65100'}>
          <StatIcon $bg="#E3F2FD" $color="#1565C0"><TrendingUp size={18} /></StatIcon>
          <StatLabel>Profit</StatLabel>
          <StatValue>{formatAmt(netProfit)}</StatValue>
        </StatCard>
        <StatCard $accent="#875200">
          <StatIcon $bg="#FFF3E0" $color="#875200"><PieChart size={18} /></StatIcon>
          <StatLabel>Net Margin</StatLabel>
          <StatValue>{netMargin}%</StatValue>
        </StatCard>
      </StatGrid>

      <ChartBox>
        <ChartTitle>Cash Flow — Net Income vs Expenses (Last 6 Months)</ChartTitle>
        <BarChart>
          {chartMonths.map(m => {
            const d = monthlyData[m];
            const incH = maxVal > 0 ? (d.income / maxVal) * 100 : 0;
            const expH = maxVal > 0 ? (d.expenses / maxVal) * 100 : 0;
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

      <ReportSection>
        <SubHeader>
          <ReportTitle>Platform Fee Breakdown</ReportTitle>
        </SubHeader>
        {platformEntries.length > 0 && (
          <PieWrap>
            <svg width="140" height="140" viewBox="0 0 32 32">
              {platformEntries.reduce((acc, [, amt]) => {
                const pct = pieTotal > 0 ? amt / pieTotal : 0;
                const angle = pct * 360;
                return acc + angle;
              }, 0)}
            </svg>
            <PieLegend>
              {platformEntries.map(([platform, amt], i) => (
                <LegendItem key={platform}>
                  <LegendDot $color={PIE_COLORS[i % PIE_COLORS.length]} />
                  <span>{platform}</span>
                  <strong>{pieTotal > 0 ? ((amt / pieTotal) * 100).toFixed(1) : '0'}%</strong>
                </LegendItem>
              ))}
            </PieLegend>
          </PieWrap>
        )}
        {Object.keys(platformBreakdown).length > 0 ? (
          <Table>
            <thead>
              <tr><Th>Platform</Th><Th style={{ textAlign: 'right' }}>Net Earnings</Th><Th style={{ textAlign: 'right' }}>% of Total</Th></tr>
            </thead>
            <tbody>
              {Object.entries(platformBreakdown).sort((a, b) => b[1] - a[1]).map(([platform, amt]) => (
                <tr key={platform}>
                  <Td><PlatformTag>{platform}</PlatformTag></Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmt(amt)}</Td>
                  <Td style={{ textAlign: 'right' }}>{totalNet > 0 ? ((amt / totalNet) * 100).toFixed(1) : '0.0'}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>No income in this period.</EmptyState>}
      </ReportSection>

      <ReportSection>
        <SubHeader>
          <ReportTitle>Income Activity</ReportTitle>
          <ExportBtn onClick={exportReport}><Download size={14} /> Export Report</ExportBtn>
        </SubHeader>
        {filteredIncome.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Client</Th><Th>Service</Th><Th>Platform</Th><Th style={{ textAlign: 'right' }}>Gross</Th><Th style={{ textAlign: 'right' }}>Net</Th></tr>
            </thead>
            <tbody>
              {filteredIncome.sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)).slice(0, 50).map(i => (
                <tr key={i.id}>
                  <Td>{i.paymentDate || '-'}</Td>
                  <Td><strong>{i.clientName || 'Client'}</strong></Td>
                  <Td>{i.milestoneLabel || i.description || '-'}</Td>
                  <Td>{i.platformTag ? <PlatformTag>{i.platformTag}</PlatformTag> : '-'}</Td>
                  <Td style={{ textAlign: 'right' }}>{formatAmt(i.amount)}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmt(i.netAmount || i.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>No income recorded in this period.</EmptyState>}
      </ReportSection>
    </>
  );

  const renderCustomers = () => (
    <>
      <StatGrid>
        <StatCard $accent="#6F240A">
          <StatIcon $bg="#F5E6D3" $color="#6F240A"><Users size={18} /></StatIcon>
          <StatLabel>Total Customers</StatLabel>
          <StatValue>{customers.length}</StatValue>
        </StatCard>
        <StatCard $accent="#2E7D32">
          <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={18} /></StatIcon>
          <StatLabel>Revenue from Customers</StatLabel>
          <StatValue>{formatAmt(totalNet)}</StatValue>
        </StatCard>
      </StatGrid>
      <ReportSection>
        <ReportTitle>Customer Revenue</ReportTitle>
        {customers.length > 0 ? (
          <Table>
            <thead><tr><Th>Name</Th><Th>Company</Th><Th>Email</Th><Th style={{ textAlign: 'right' }}>Revenue</Th></tr></thead>
            <tbody>
              {customers.map(c => {
                const custIncome = income.filter(i => i.clientName === c.name);
                const rev = custIncome.reduce((s, i) => s + (parseFloat(i.netAmount || i.amount) || 0), 0);
                return (
                  <tr key={c.id}>
                    <Td><strong>{c.name}</strong></Td>
                    <Td>{c.company || '-'}</Td>
                    <Td>{c.email || '-'}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmt(rev)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState>No customers yet.</EmptyState>}
      </ReportSection>
    </>
  );

  return (
    <Container>
      <Title>Reports</Title>

      <Tabs>
        <Tab $active={tab === 'overview'} onClick={() => setTab('overview')}>P&L Overview</Tab>
        <Tab $active={tab === 'customers'} onClick={() => setTab('customers')}>Customers</Tab>
      </Tabs>

      <DateRange>
        <Calendar size={16} color="#89726C" />
        <DateInput type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span>to</span>
        <DateInput type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </DateRange>

      {tab === 'overview' && renderOverview()}
      {tab === 'customers' && renderCustomers()}
    </Container>
  );
};

export default ServiceReporting;
