import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { fetchSales, fetchExpenses, fetchInvoices, fetchInventory } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatCurrencyShort } from '../../utils/currency';

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
`;

const ReportGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 3rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const ReportCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 60px;
    height: 60px;
    background: radial-gradient(circle at top right, ${props => props.$color || props.theme.colors.primary} 0%, transparent 70%);
    opacity: 0.1;
  }
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: ${props => props.$bg || 'rgba(111, 36, 10, 0.05)'};
  color: ${props => props.$color || props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
`;

const ReportTitle = styled.h3`
  font-size: 1.25rem;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 0.5rem;
`;

const ReportDescription = styled.p`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-bottom: 1.5rem;
  flex-grow: 1;
`;

const ActionButton = styled.button`
  background: ${({ theme, $variant }) => $variant === 'secondary' ? 'white' : theme.colors.primary};
  color: ${({ theme, $variant }) => $variant === 'secondary' ? theme.colors.primary : 'white'};
  border: ${({ theme, $variant }) => $variant === 'secondary' ? `1px solid ${theme.colors.outlineVariant}` : 'none'};
  padding: 0.75rem 1.25rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};
  width: 100%;

  &:hover {
    filter: brightness(1.1);
    background: ${({ theme, $variant }) => $variant === 'secondary' ? 'rgba(111, 36, 10, 0.03)' : theme.colors.primary};
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 3rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryItem = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 600px) {
    padding: 1rem;

    div:first-child div:last-child {
      font-size: 1.15rem !important;
    }
  }
`;

const ChartSection = styled.section`
  margin-bottom: 3rem;
`;

const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ChartTitle = styled.h3`
  font-size: 1rem;
  color: #1C1C18;
  margin: 0;
`;

const ChartBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #89726C;
  background: #F5F3F0;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
`;

const FullWidthChartCard = styled(ChartCard)`
  grid-column: 1 / -1;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 0.75rem;
  background: #FAF7F4;
  color: #6F240A;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #F0EEE8;
`;

const Td = styled.td`
  padding: 0.75rem;
  border-bottom: 1px solid #F0EEE8;
`;

const COLORS = ['#6F240A', '#875200', '#25432F', '#BA1A1A', '#D4A373', '#55423D', '#89726C', '#A68B7B'];

const CustomTooltip = ({ active, payload, label }) => {
  const { currency } = useSettingsStore();
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #F0EEE8',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: '0.875rem'
      }}>
        <div style={{ fontWeight: 700, color: '#1C1C18', marginBottom: '0.25rem' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {p.name === 'Count' ? p.value : formatCurrency(p.value, currency)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AutomatedReporting = () => {
  const { currency } = useSettingsStore();
  const [data, setData] = useState({
    sales: [],
    expenses: [],
    invoices: [],
    inventory: [],
    loading: true
  });

  const loadData = async () => {
    try {
      const [sales, expenses, invoices, inventory] = await Promise.all([
        fetchSales(),
        fetchExpenses(),
        fetchInvoices(),
        fetchInventory()
      ]);
      setData({ sales, expenses, invoices, inventory, loading: false });
    } catch (error) {
      console.error('Failed to load reporting data', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const formatCurrencyLocal = (value) => formatCurrency(value, currency);

  const revenue = data.sales.reduce((acc, s) => acc + parseAmount(s.totalAmount || s.amount), 0) +
                  data.invoices.filter(inv => inv.status?.toLowerCase() === 'paid').reduce((acc, inv) => acc + parseAmount(inv.amount || inv.totalAmount), 0);
  
  const totalExpenses = data.expenses.reduce((acc, e) => acc + parseAmount(e.amount || e.totalAmount), 0);
  const netProfit = revenue - totalExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const inventoryCost = {};
  data.inventory.forEach(i => {
    inventoryCost[i.name] = parseAmount(i.costPrice);
  });

  const costOf = (sale) => {
    const unitCost = (sale.cost != null && sale.cost !== '')
      ? parseAmount(sale.cost)
      : (inventoryCost[sale.item] || 0);
    return unitCost * (parseInt(sale.quantity) || 1);
  };

  const profitOf = (sale) => parseAmount(sale.totalAmount || sale.amount) - costOf(sale);
  const grossProfit = data.sales.reduce((acc, s) => acc + profitOf(s), 0);
  const cogs = data.sales.reduce((acc, s) => acc + costOf(s), 0);
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const profitByProduct = useMemo(() => {
    const grouped = {};
    data.sales.forEach(s => {
      if (!grouped[s.item]) grouped[s.item] = { name: s.item, units: 0, revenue: 0, cost: 0 };
      grouped[s.item].units += parseInt(s.quantity) || 1;
      grouped[s.item].revenue += parseAmount(s.totalAmount || s.amount);
      grouped[s.item].cost += costOf(s);
    });
    return Object.values(grouped)
      .map(g => ({ ...g, profit: g.revenue - g.cost, margin: g.revenue > 0 ? ((g.revenue - g.cost) / g.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [data.sales, data.inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  const profitByCustomer = useMemo(() => {
    const grouped = {};
    data.invoices.forEach(inv => {
      const name = (inv.customer || '').trim() || 'Unknown';
      if (!grouped[name]) grouped[name] = { name, revenue: 0, cost: 0, invoices: 0 };
      const lineCost = Array.isArray(inv.items)
        ? inv.items.reduce((acc, li) => acc + (inventoryCost[li.name] || 0) * (parseInt(li.quantity) || 1), 0)
        : 0;
      grouped[name].revenue += parseAmount(inv.amount || inv.totalAmount);
      grouped[name].cost += lineCost;
      grouped[name].invoices += 1;
    });
    return Object.values(grouped)
      .map(g => ({ ...g, profit: g.revenue - g.cost, margin: g.revenue > 0 ? ((g.revenue - g.cost) / g.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [data.invoices, data.inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  const salesByDate = useMemo(() => {
    const grouped = {};
    data.sales.forEach(s => {
      const date = s.date || 'Unknown';
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += parseAmount(s.totalAmount || s.amount);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [data.sales]);

  const expensesByCategory = useMemo(() => {
    const grouped = {};
    data.expenses.forEach(e => {
      const cat = e.category || 'Other';
      if (!grouped[cat]) grouped[cat] = 0;
      grouped[cat] += parseAmount(e.amount || e.totalAmount);
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.expenses]);

  const revenueVsExpenses = useMemo(() => {
    const byDate = {};
    data.sales.forEach(s => {
      const date = s.date || 'Unknown';
      if (!byDate[date]) byDate[date] = { date, revenue: 0, expenses: 0 };
      byDate[date].revenue += parseAmount(s.totalAmount || s.amount);
    });
    data.expenses.forEach(e => {
      const date = e.date || 'Unknown';
      if (!byDate[date]) byDate[date] = { date, revenue: 0, expenses: 0 };
      byDate[date].expenses += parseAmount(e.amount || e.totalAmount);
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.sales, data.expenses]);

  const handleGenerateReport = (type) => {
    let exportData, headers, fileName;

    switch(type) {
      case 'sales':
        exportData = data.sales.map(s => ({
          date: s.date || '',
          customer: s.customer || 'Random Buyer',
          'Item Sold': s.item,
          quantity: s.quantity || 1,
          'Total Amount': s.amount || formatCurrencyLocal(parseAmount(s.totalAmount))
        }));
        headers = { date: 'Date', customer: 'Customer', 'Item Sold': 'Item Sold', quantity: 'Quantity', 'Total Amount': 'Total Amount' };
        fileName = 'Sales_Report';
        break;
      case 'expenses':
        exportData = data.expenses;
        headers = { date: 'Date', description: 'Description', category: 'Category', amount: 'Amount' };
        fileName = 'Expense_Report';
        break;
      case 'invoices':
        exportData = data.invoices;
        headers = { id: 'ID', date: 'Date', customer: 'Customer', amount: 'Amount', status: 'Status' };
        fileName = 'Invoice_Report';
        break;
      default: return;
    }

    const csv = convertToCSV(exportData, headers);
    downloadCSV(csv, `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (data.loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading reports...</div>;
  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Automated Reporting</h1>
          <p style={{ color: '#55423D' }}>Generate and manage financial reports for stakeholders.</p>
        </div>
      </Header>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#1C1C18' }}>Profit & Loss Breakdown</h2>
        <SummaryGrid>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Total Revenue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#25432F' }}>{formatCurrencyShort(revenue, currency)}</div>
            </div>
            <TrendingUp color="#25432F" size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Cost of Goods Sold</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#875200' }}>{formatCurrencyShort(cogs, currency)}</div>
            </div>
            <TrendingDown color="#875200" size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Gross Profit</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: grossProfit >= 0 ? '#25432F' : '#BA1A1A' }}>
                {formatCurrencyShort(grossProfit, currency)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#89726C' }}>{grossMargin.toFixed(1)}% margin</div>
            </div>
            <DollarSign color={grossProfit >= 0 ? '#25432F' : '#BA1A1A'} size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Total Expenses</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#BA1A1A' }}>{formatCurrencyShort(totalExpenses, currency)}</div>
            </div>
            <TrendingDown color="#BA1A1A" size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Net Profit</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: netProfit >= 0 ? '#25432F' : '#BA1A1A' }}>
                {formatCurrencyShort(netProfit, currency)}
              </div>
            </div>
            <DollarSign color={netProfit >= 0 ? '#25432F' : '#BA1A1A'} size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
          <SummaryItem>
            <div>
              <div style={{ color: '#89726C', fontSize: '0.875rem' }}>Profit Margin</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#875200' }}>{profitMargin.toFixed(1)}%</div>
            </div>
            <FileText color="#875200" size={32} style={{ opacity: 0.2 }} />
          </SummaryItem>
        </SummaryGrid>
      </section>

      <ChartSection>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#1C1C18' }}>Analytics & Insights</h2>
        <ChartGrid>
          <ChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="#6F240A" />
                <ChartTitle>Daily Sales Trend</ChartTitle>
              </div>
              <ChartBadge>Revenue</ChartBadge>
            </ChartHeader>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByDate} barSize={32} barGap={4}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#89726C' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#89726C' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(111, 36, 10, 0.04)' }} />
                <Bar dataKey="amount" fill="#6F240A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} color="#875200" />
                <ChartTitle>Expense Breakdown</ChartTitle>
              </div>
              <ChartBadge>Categories</ChartBadge>
            </ChartHeader>
            <ResponsiveContainer width="100%" height={250}>
              <RePieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {expensesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: '#55423D' }}
                  iconType="circle"
                  iconSize={8}
                />
              </RePieChart>
            </ResponsiveContainer>
          </ChartCard>

          <FullWidthChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="#25432F" />
                <ChartTitle>Revenue vs Expenses</ChartTitle>
              </div>
              <ChartBadge>Comparison</ChartBadge>
            </ChartHeader>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueVsExpenses} barSize={24} barGap={6}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#89726C' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#89726C' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#25432F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#BA1A1A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </FullWidthChartCard>

          <FullWidthChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="#875200" />
                <ChartTitle>Gross Profit by Product</ChartTitle>
              </div>
              <ChartBadge>After cost of goods</ChartBadge>
            </ChartHeader>
            {profitByProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(220, profitByProduct.slice(0, 8).length * 42 + 30)}>
                <BarChart data={profitByProduct.slice(0, 8)} barSize={24} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1C1C18' }} tickLine={false} axisLine={false} width={130} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="profit" name="Profit" fill="#875200" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#89726C' }}>No sales yet — record sales to see profitability.</div>
            )}
          </FullWidthChartCard>
        </ChartGrid>
      </ChartSection>

      <ChartSection>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#1C1C18' }}>Profitability Breakdown</h2>
        <ChartGrid>
          <FullWidthChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="#6F240A" />
                <ChartTitle>Product Profitability</ChartTitle>
              </div>
              <ChartBadge>Margin</ChartBadge>
            </ChartHeader>
            {profitByProduct.length > 0 ? (
              <Table>
                <thead>
                  <tr><Th>Product</Th><Th style={{ textAlign: 'right' }}>Units</Th><Th style={{ textAlign: 'right' }}>Revenue</Th><Th style={{ textAlign: 'right' }}>Cost</Th><Th style={{ textAlign: 'right' }}>Profit</Th><Th style={{ textAlign: 'right' }}>Margin</Th></tr>
                </thead>
                <tbody>
                  {profitByProduct.map(p => (
                    <tr key={p.name}>
                      <Td style={{ fontWeight: 700 }}>{p.name}</Td>
                      <Td style={{ textAlign: 'right' }}>{p.units}</Td>
                      <Td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue, currency)}</Td>
                      <Td style={{ textAlign: 'right' }}>{formatCurrency(p.cost, currency)}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, color: p.profit >= 0 ? '#25432F' : '#BA1A1A' }}>{formatCurrency(p.profit, currency)}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, color: p.margin >= 0 ? '#25432F' : '#BA1A1A' }}>{p.margin.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#89726C' }}>No sales yet.</div>
            )}
          </FullWidthChartCard>

          <FullWidthChartCard>
            <ChartHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="#25432F" />
                <ChartTitle>Profit by Customer</ChartTitle>
              </div>
              <ChartBadge>Invoices</ChartBadge>
            </ChartHeader>
            {profitByCustomer.length > 0 ? (
              <Table>
                <thead>
                  <tr><Th>Customer</Th><Th style={{ textAlign: 'right' }}>Invoices</Th><Th style={{ textAlign: 'right' }}>Billed</Th><Th style={{ textAlign: 'right' }}>Cost</Th><Th style={{ textAlign: 'right' }}>Profit</Th><Th style={{ textAlign: 'right' }}>Margin</Th></tr>
                </thead>
                <tbody>
                  {profitByCustomer.map(c => (
                    <tr key={c.name}>
                      <Td style={{ fontWeight: 700 }}>{c.name}</Td>
                      <Td style={{ textAlign: 'right' }}>{c.invoices}</Td>
                      <Td style={{ textAlign: 'right' }}>{formatCurrency(c.revenue, currency)}</Td>
                      <Td style={{ textAlign: 'right' }}>{formatCurrency(c.cost, currency)}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, color: c.profit >= 0 ? '#25432F' : '#BA1A1A' }}>{formatCurrency(c.profit, currency)}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 700, color: c.margin >= 0 ? '#25432F' : '#BA1A1A' }}>{c.margin.toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#89726C' }}>No invoices yet.</div>
            )}
          </FullWidthChartCard>
        </ChartGrid>
      </ChartSection>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#1C1C18' }}>Generate Reports</h2>
        <ReportGrid>
          <ReportCard $color="#6F240A">
            <IconWrapper $bg="rgba(111, 36, 10, 0.05)" $color="#6F240A"><Calendar size={24} /></IconWrapper>
            <ReportTitle>Sales Summary</ReportTitle>
            <ReportDescription>Export all point-of-sale data including customer details and items.</ReportDescription>
            <ActionButton onClick={() => handleGenerateReport('sales')}>
              Generate CSV
              <Download size={16} />
            </ActionButton>
          </ReportCard>
          <ReportCard $color="#875200">
            <IconWrapper $bg="rgba(135, 82, 0, 0.05)" $color="#875200"><FileText size={24} /></IconWrapper>
            <ReportTitle>Expense Audit</ReportTitle>
            <ReportDescription>Detailed breakdown of all outflows and production costs.</ReportDescription>
            <ActionButton onClick={() => handleGenerateReport('expenses')}>
              Generate CSV
              <Download size={16} />
            </ActionButton>
          </ReportCard>
          <ReportCard $color="#25432F">
            <IconWrapper $bg="rgba(37, 67, 47, 0.05)" $color="#25432F"><FileText size={24} /></IconWrapper>
            <ReportTitle>Invoice Ledger</ReportTitle>
            <ReportDescription>Summary of wholesale partner transactions and payment statuses.</ReportDescription>
            <ActionButton onClick={() => handleGenerateReport('invoices')}>
              Generate CSV
              <Download size={16} />
            </ActionButton>
          </ReportCard>
        </ReportGrid>
      </section>
    </div>
  );
};

export default AutomatedReporting;
