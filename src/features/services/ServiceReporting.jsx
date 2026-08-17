import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Download, DollarSign, TrendingUp, TrendingDown, PieChart, Users, Calendar } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart as RPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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

const TWO_COL = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PIE_COLORS = ['#6F240A', '#D4AF37', '#25432F', '#1E3A8A', '#8B5E7C', '#875200', '#BA1A1A', '#4A6741'];

const tooltipStyle = { borderRadius: 8, border: '1px solid #E8E5DF', fontSize: 13 };

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
  const cashFlowData = chartMonths.map(m => {
    const parts = m.split('-');
    return { name: `${MONTHS[parseInt(parts[1]) - 1]}`, Income: monthlyData[m].income, Expenses: monthlyData[m].expenses };
  });

  const platformEntries = Object.entries(platformBreakdown).sort((a, b) => b[1] - a[1]);
  const platformPieData = platformEntries.map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const clientRevenue = {};
  filteredIncome.forEach(i => {
    const name = i.clientName || 'Unknown';
    clientRevenue[name] = (clientRevenue[name] || 0) + (parseFloat(i.netAmount || i.amount) || 0);
  });
  const topClientsData = Object.entries(clientRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, revenue]) => ({ name: name.length > 14 ? name.slice(0, 12) + '..' : name, revenue: parseFloat(revenue.toFixed(2)) }));

  const expenseCategories = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || e.subcategory || 'Uncategorized';
    const amt = parseFloat(String(e.amount).replace(/[^\d.-]/g, '')) || 0;
    expenseCategories[cat] = (expenseCategories[cat] || 0) + amt;
  });
  const expensePieData = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

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
        <ChartTitle>Cash Flow — Income vs Expenses (Last 6 Months)</ChartTitle>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={cashFlowData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="rptGradIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#25432F" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#25432F" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rptGradExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C62828" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#C62828" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#89726C' }} tickLine={false} axisLine={{ stroke: '#E8E5DF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`GH₵${Number(value).toFixed(2)}`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Income" stroke="#25432F" strokeWidth={2.5} fill="url(#rptGradIncome)" dot={{ r: 4, fill: '#25432F', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Area type="monotone" dataKey="Expenses" stroke="#C62828" strokeWidth={2.5} fill="url(#rptGradExpense)" strokeDasharray="6 3" dot={{ r: 4, fill: '#C62828', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>

      <TWO_COL>
        <ChartBox>
          <ChartTitle>Revenue by Platform</ChartTitle>
          {platformPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RPieChart>
                <Pie data={platformPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {platformPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={value => [`GH₵${Number(value).toFixed(2)}`]} />
              </RPieChart>
            </ResponsiveContainer>
          ) : <EmptyState>No platform data.</EmptyState>}
        </ChartBox>

        <ChartBox>
          <ChartTitle>Expense Breakdown</ChartTitle>
          {expensePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RPieChart>
                <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {expensePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={value => [`GH₵${Number(value).toFixed(2)}`]} />
              </RPieChart>
            </ResponsiveContainer>
          ) : <EmptyState>No expense data.</EmptyState>}
        </ChartBox>
      </TWO_COL>

      {topClientsData.length > 0 && (
        <ChartBox>
          <ChartTitle>Top Clients by Revenue</ChartTitle>
          <ResponsiveContainer width="100%" height={Math.max(200, topClientsData.length * 45 + 30)}>
            <BarChart data={topClientsData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1C1C18' }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={value => [`GH₵${Number(value).toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#6F240A" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

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
