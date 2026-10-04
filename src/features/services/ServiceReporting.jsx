import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Download, DollarSign, TrendingUp, TrendingDown, PieChart, Users, Wallet, AlertCircle, Search } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart as RPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchServiceIncome, fetchRecurringIncome, fetchExpenses, fetchCustomers, fetchInvoices } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { formatCurrency, parseAmount } from '../../utils/currency';
import { serviceProfit, serviceRowReceived } from '../../utils/serviceFinance';

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
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.muted};
  letter-spacing: 0.05em;
`;

const StatNote = styled.div`
  font-size: 0.7rem;
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: 0.15rem;
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
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* Filter toolbar, mirroring the Sales History page. */
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const PresetButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.outlineVariant)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'white')};
  color: ${({ theme, $active }) => ($active ? 'white' : theme.colors.text.muted)};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  background: white;

  input {
    border: none;
    outline: none;
    font-size: 0.85rem;
    width: 100%;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.main};
  }
`;

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;
`;

const RowCount = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.muted};
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

const todayISO = () => new Date().toISOString().split('T')[0];

const shiftDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

const startOfYear = (iso) => `${iso.slice(0, 4)}-01-01`;

/* Same range presets as the Sales History page, plus a quarter and a year. */
const PRESETS = [
  { key: 'month', label: 'This month' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const PIE_COLORS = ['#6F240A', '#D4AF37', '#25432F', '#1E3A8A', '#8B5E7C', '#875200', '#BA1A1A', '#4A6741'];

const tooltipStyle = { borderRadius: 8, border: '1px solid #E8E5DF', fontSize: 13 };

const ServiceReporting = () => {
  const [tab, setTab] = useState('overview');
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('90');
  const [searchTerm, setSearchTerm] = useState('');
  const [incomePage, setIncomePage] = useState(1);

  useEffect(() => {
    Promise.all([
      fetchServiceIncome(), fetchRecurringIncome(), fetchExpenses(),
      fetchCustomers(), fetchInvoices(),
    ]).then(([i, , e, c, inv]) => {
      setIncome(i); setExpenses(e); setCustomers(c); setInvoices(inv);
    });
  }, []);

  const applyPreset = (key) => {
    setPreset(key);
    const today = todayISO();
    if (key === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(today);
    } else if (key === '30') {
      setStartDate(shiftDays(today, -29));
      setEndDate(today);
    } else if (key === '90') {
      setStartDate(shiftDays(today, -89));
      setEndDate(today);
    } else if (key === 'year') {
      setStartDate(startOfYear(today));
      setEndDate(today);
    } else {
      // All time. An empty bound means "unbounded" everywhere below, so the
      // filters must not build an Invalid Date out of it.
      setStartDate('');
      setEndDate('');
    }
    setIncomePage(1);
  };

  const onStartChange = (value) => { setStartDate(value); setPreset('custom'); setIncomePage(1); };
  const onEndChange = (value) => { setEndDate(value); setPreset('custom'); setIncomePage(1); };

  const inRange = (items, dateField) => {
    if (!startDate && !endDate) return items;
    return items.filter(item => {
      const raw = item[dateField];
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;
      return true;
    });
  };

  const matches = (row, fields) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return fields.some(field => {
      const value = row[field];
      if (value === null || value === undefined) return false;
      if (typeof value === 'object') return JSON.stringify(value).toLowerCase().includes(term);
      return String(value).toLowerCase().includes(term);
    });
  };

  const filteredIncome = useMemo(
    () => inRange(income, 'paymentDate')
      .filter(i => matches(i, ['clientName', 'milestoneLabel', 'description', 'platformTag', 'notes', 'category'])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [income, startDate, endDate, searchTerm],
  );

  const filteredExpenses = useMemo(
    () => inRange(expenses, 'date')
      .filter(e => matches(e, ['title', 'category', 'subcategory', 'vendor', 'clientName', 'notes'])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, startDate, endDate, searchTerm],
  );

  const filteredInvoices = useMemo(
    () => inRange(invoices, 'date')
      .filter(i => matches(i, ['customer', 'id', 'status', 'notes'])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, startDate, endDate, searchTerm],
  );

  const filteredCustomers = useMemo(
    () => customers.filter(c => matches(c, ['name', 'company', 'email', 'phone', 'notes'])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, searchTerm],
  );

  /* Per-client P&L. Hoisted out of the tab so the export and the table are
     guaranteed to be built from the same rows. */
  const clientRows = useMemo(() => {
    const incomeByName = {};
    filteredIncome.forEach(i => {
      const name = (i.clientName || '').trim() || 'Unknown';
      incomeByName[name] = (incomeByName[name] || 0) + serviceRowReceived(i);
    });
    const expensesByName = {};
    filteredExpenses.forEach(e => {
      const name = (e.clientName || '').trim();
      if (!name) return;
      expensesByName[name] = (expensesByName[name] || 0) + parseAmount(e.amount);
    });
    const names = [...new Set([
      ...filteredCustomers.map(c => (c.name || '').trim()).filter(Boolean),
      ...Object.keys(incomeByName),
      ...Object.keys(expensesByName),
    ])];
    return names.map(name => {
      const inc = incomeByName[name] || 0;
      const exp = expensesByName[name] || 0;
      const profit = inc - exp;
      return {
        name,
        income: parseFloat(inc.toFixed(2)),
        expenses: parseFloat(exp.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        margin: inc > 0 ? ((profit / inc) * 100).toFixed(1) : '0.0',
      };
    })
      .filter(r => r.income > 0 || r.expenses > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [filteredIncome, filteredExpenses, filteredCustomers]);

  /* Customer revenue must be built from the filtered income, otherwise the
     "Revenue from Customers" card (which is date filtered) disagrees with the
     table printed directly beneath it. Income that names no known customer is
     surfaced as its own row so the column still adds up to the card. */
  const customerRows = useMemo(() => {
    const known = new Set(filteredCustomers.map(c => (c.name || '').trim()));
    const rows = filteredCustomers.map(c => ({
      id: c.id,
      name: c.name || '',
      company: c.company || '',
      email: c.email || '',
      phone: c.phone || '',
      revenue: filteredIncome
        .filter(i => (i.clientName || '').trim() === (c.name || '').trim())
        .reduce((s, i) => s + serviceRowReceived(i), 0),
    }));
    const unassigned = filteredIncome
      .filter(i => !known.has((i.clientName || '').trim()))
      .reduce((s, i) => s + serviceRowReceived(i), 0);
    return { rows, unassigned };
  }, [filteredCustomers, filteredIncome]);

  const customerRevenueTotal = customerRows.rows.reduce((s, r) => s + r.revenue, 0) + customerRows.unassigned;

  /* Outstanding balances. Invoice payments are matched against ALL income, not
     the filtered set: an invoice raised last year and settled today is still
     settled, and must not resurface as overdue inside a narrower date range. */
  const outstandingRows = useMemo(() => {
    const paymentsFor = (inv) => income.filter(i =>
      (i.platformTag === 'invoice' || i.platformTag === 'payment') &&
      new RegExp('invoice #' + String(inv.id) + '(?!\\d)', 'i').test(String(i.notes || ''))
    );
    const paidAmountOf = (inv) => {
      if (inv.status === 'paid') return parseAmount(inv.amount);
      const paid = paymentsFor(inv).reduce((s, i) => s + serviceRowReceived(i), 0);
      return Math.min(paid, parseAmount(inv.amount));
    };
    return filteredInvoices.map(inv => {
      const amount = parseAmount(inv.amount);
      const paid = paidAmountOf(inv);
      const items = Array.isArray(inv.items) ? inv.items.filter(i => !i.type) : [];
      return {
        customer: inv.customer || 'Unknown',
        invoiceId: inv.id,
        service: items[0]?.name || `Invoice #${inv.id}`,
        date: inv.date || '',
        amount,
        paid,
        balance: Math.max(0, amount - paid),
      };
    })
      .filter(r => r.balance > 0)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [filteredInvoices, income]);

  // Same helper the services dashboard uses, so the two pages cannot disagree.
  const { received: totalNet, expenses: totalExpenses, profit: netProfit, fees: totalFees, margin: netMargin } =
    serviceProfit(filteredIncome, filteredExpenses);

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

  const formatAmt = (v) => `${formatCurrency((v || 0))}`;

  const sortedIncome = useMemo(
    () => [...filteredIncome].sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)),
    [filteredIncome],
  );

  const sortedExpenses = useMemo(
    () => [...filteredExpenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [filteredExpenses],
  );

  const INCOME_PAGE_SIZE = 25;
  const incomeTotalPages = Math.max(1, Math.ceil(sortedIncome.length / INCOME_PAGE_SIZE));
  const visibleIncome = sortedIncome.slice((incomePage - 1) * INCOME_PAGE_SIZE, incomePage * INCOME_PAGE_SIZE);

  const rangeStamp = () => `${startDate || 'all'}_to_${endDate || 'today'}`;
  const rangeLabel = startDate || endDate ? `${startDate || 'start'} to ${endDate || 'today'}` : 'all recorded activity';

  const save = (rows, headers, name) => {
    downloadCSV(convertToCSV(rows, headers), `${name}_${rangeStamp()}.csv`);
  };

  /* Every export below covers the rows currently shown by the filters and the
     search box, not just the visible page, so the CSV always reconciles with
     the stat cards above it. */
  const exportIncome = () => save(sortedIncome.map(i => ({
    date: i.paymentDate || '',
    client: i.clientName || '',
    service: i.milestoneLabel || i.description || '',
    platform: i.platformTag || '',
    category: i.category || '',
    gross: parseAmount(i.amount).toFixed(2),
    fee: parseAmount(i.platformFee).toFixed(2),
    received: serviceRowReceived(i).toFixed(2),
    notes: i.notes || '',
    id: i.id,
  })), {
    date: 'Date', client: 'Client', service: 'Service', platform: 'Platform', category: 'Category',
    gross: 'Gross Amount', fee: 'Platform Fee', received: 'Net Received', notes: 'Notes', id: 'Income ID',
  }, 'Service_Income');

  const exportExpenses = () => save(sortedExpenses.map(e => ({
    date: e.date || '',
    title: e.title || '',
    category: e.category || '',
    subcategory: e.subcategory || '',
    vendor: e.vendor || '',
    client: e.clientName || '',
    amount: parseAmount(e.amount).toFixed(2),
    transactionFee: parseAmount(e.transactionFee).toFixed(2),
    isAsset: e.isAsset ? 'Yes' : 'No',
    renewal: e.renewalDate || '',
    id: e.id,
  })), {
    date: 'Date', title: 'Expense', category: 'Category', subcategory: 'Subcategory', vendor: 'Vendor',
    client: 'Client', amount: 'Amount', transactionFee: 'Transaction Fee (included in amount)',
    isAsset: 'Asset', renewal: 'Renewal Date', id: 'Expense ID',
  }, 'Service_Expenses');

  const exportClients = () => save(clientRows.map(r => ({
    client: r.name,
    income: r.income.toFixed(2),
    expenses: r.expenses.toFixed(2),
    profit: r.profit.toFixed(2),
    margin: `${r.margin}%`,
  })), {
    client: 'Client', income: 'Income Received', expenses: 'Expenses', profit: 'Profit', margin: 'Margin %',
  }, 'Service_Client_PL');

  const exportOutstanding = () => save(outstandingRows.map(r => ({
    customer: r.customer,
    service: r.service,
    invoice: r.invoiceId,
    date: r.date || '',
    billed: r.amount.toFixed(2),
    paid: r.paid.toFixed(2),
    balance: r.balance.toFixed(2),
    status: r.date && r.date < todayISO() ? 'Overdue' : 'Open',
  })), {
    customer: 'Customer', service: 'Service', invoice: 'Invoice #', date: 'Date',
    billed: 'Billed', paid: 'Paid', balance: 'Balance', status: 'Status',
  }, 'Service_Outstanding');

  const exportCustomers = () => save(customerRows.rows.map(c => ({
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    revenue: c.revenue.toFixed(2),
    invoices: String(invoices.filter(inv => (inv.customer || '').trim() === c.name.trim()).length),
  })), {
    name: 'Name', company: 'Company', email: 'Email', phone: 'Phone',
    revenue: 'Revenue Received', invoices: 'Invoices',
  }, 'Service_Customers');

  const renderOverview = () => (
    <>
      <StatGrid>
        <StatCard $accent="#2E7D32">
          <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={18} /></StatIcon>
          <StatLabel>Net Income</StatLabel>
          <StatValue>{formatAmt(totalNet)}</StatValue>
          {totalFees > 0 && <StatNote>After {formatAmt(totalFees)} platform fees</StatNote>}
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
          <StatValue>{netMargin === null ? 'â€”' : `${netMargin}%`}</StatValue>
        </StatCard>
      </StatGrid>

      <ChartBox>
        <ChartTitle>Cash Flow â€” Income vs Expenses (Last 6 Months)</ChartTitle>
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
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${formatCurrency(Number(value))}`, name]} />
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
                <Tooltip contentStyle={tooltipStyle} formatter={value => [`${formatCurrency(Number(value))}`]} />
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
                <Tooltip contentStyle={tooltipStyle} formatter={value => [`${formatCurrency(Number(value))}`]} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={value => [`${formatCurrency(Number(value))}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#6F240A" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      )}

      <ReportSection>
        <SubHeader>
          <ReportTitle>Income Activity</ReportTitle>
          <ExportBtn onClick={exportIncome} disabled={sortedIncome.length === 0}>
            <Download size={14} /> Export CSV
          </ExportBtn>
        </SubHeader>
        {filteredIncome.length > 0 ? (
          <>
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Client</Th><Th>Service</Th><Th>Platform</Th><Th style={{ textAlign: 'right' }}>Gross</Th><Th style={{ textAlign: 'right' }}>Fee</Th><Th style={{ textAlign: 'right' }}>Net</Th></tr>
            </thead>
            <tbody>
              {visibleIncome.map(i => (
                <tr key={i.id}>
                  <Td>{i.paymentDate || '-'}</Td>
                  <Td><strong>{i.clientName || 'Client'}</strong></Td>
                  <Td>{i.milestoneLabel || i.description || '-'}</Td>
                  <Td>{i.platformTag ? <PlatformTag>{i.platformTag}</PlatformTag> : '-'}</Td>
                  <Td style={{ textAlign: 'right' }}>{formatAmt(i.amount)}</Td>
                  <Td style={{ textAlign: 'right', color: '#C62828' }}>{parseAmount(i.platformFee) > 0 ? formatAmt(i.platformFee) : '-'}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmt(serviceRowReceived(i))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <SubHeader style={{ marginTop: '0.75rem' }}>
            <RowCount>
              Showing {(incomePage - 1) * INCOME_PAGE_SIZE + 1}–{Math.min(incomePage * INCOME_PAGE_SIZE, sortedIncome.length)} of {sortedIncome.length} income record(s)
            </RowCount>
          </SubHeader>

          {incomeTotalPages > 1 && (
            <Pager>
              <PresetButton type="button" disabled={incomePage === 1}
                onClick={() => setIncomePage(p => Math.max(1, p - 1))}>Previous</PresetButton>
              <span>Page {incomePage} of {incomeTotalPages}</span>
              <PresetButton type="button" disabled={incomePage === incomeTotalPages}
                onClick={() => setIncomePage(p => Math.min(incomeTotalPages, p + 1))}>Next</PresetButton>
            </Pager>
          )}
          </>
        ) : <EmptyState>No income recorded in this period.</EmptyState>}
      </ReportSection>

      <ReportSection>
        <SubHeader>
          <ReportTitle>Expense Activity</ReportTitle>
          <ExportBtn onClick={exportExpenses} disabled={sortedExpenses.length === 0}>
            <Download size={14} /> Export CSV
          </ExportBtn>
        </SubHeader>
        {sortedExpenses.length > 0 ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th><Th>Expense</Th><Th>Category</Th><Th>Vendor</Th>
                  <Th style={{ textAlign: 'right' }}>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map(e => (
                  <tr key={e.id}>
                    <Td>{e.date || '-'}</Td>
                    <Td><strong>{e.title || 'Expense'}</strong></Td>
                    <Td>{e.category || e.subcategory || '-'}</Td>
                    <Td>{e.vendor || '-'}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700, color: '#C62828' }}>
                      {formatAmt(e.amount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <SubHeader style={{ marginTop: '0.75rem' }}>
              <RowCount>{sortedExpenses.length} expense record(s)</RowCount>
            </SubHeader>
          </>
        ) : <EmptyState>No expenses recorded in this period.</EmptyState>}
      </ReportSection>
    </>
  );

  const renderCustomers = () => (
    <>
      <StatGrid>
        <StatCard $accent="#6F240A">
          <StatIcon $bg="#F5E6D3" $color="#6F240A"><Users size={18} /></StatIcon>
          <StatLabel>Total Customers</StatLabel>
          <StatValue>{customerRows.rows.length}</StatValue>
        </StatCard>
        <StatCard $accent="#2E7D32">
          <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={18} /></StatIcon>
          <StatLabel>Revenue from Customers</StatLabel>
          <StatValue>{formatAmt(customerRevenueTotal)}</StatValue>
        </StatCard>
      </StatGrid>
      <ReportSection>
        <SubHeader>
          <ReportTitle>Customer Revenue</ReportTitle>
          <ExportBtn onClick={exportCustomers} disabled={customerRows.rows.length === 0}>
            <Download size={14} /> Export CSV
          </ExportBtn>
        </SubHeader>
        {customerRows.rows.length > 0 ? (
          <Table>
            <thead><tr><Th>Name</Th><Th>Company</Th><Th>Email</Th><Th style={{ textAlign: 'right' }}>Revenue</Th></tr></thead>
            <tbody>
              {customerRows.rows.map(c => (
                <tr key={c.id}>
                  <Td><strong>{c.name}</strong></Td>
                  <Td>{c.company || '-'}</Td>
                  <Td>{c.email || '-'}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmt(c.revenue)}</Td>
                </tr>
              ))}
              {customerRows.unassigned > 0 && (
                <tr>
                  <Td><strong>Income with no matching customer</strong></Td>
                  <Td>-</Td>
                  <Td>-</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700, color: '#875200' }}>
                    {formatAmt(customerRows.unassigned)}
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        ) : <EmptyState>No customers yet.</EmptyState>}
      </ReportSection>
    </>
  );

  const renderClients = () => {
    const totalProfit = clientRows.reduce((s, r) => s + r.profit, 0);
    const profitableCount = clientRows.filter(r => r.profit > 0).length;
    const chartData = clientRows.slice(0, 8).map(r => ({
      name: r.name.length > 14 ? r.name.slice(0, 12) + '..' : r.name,
      profit: r.profit,
    }));

    return (
      <>
        <StatGrid>
          <StatCard $accent="#6F240A">
            <StatIcon $bg="#F5E6D3" $color="#6F240A"><Users size={18} /></StatIcon>
            <StatLabel>Clients Tracked</StatLabel>
            <StatValue>{clientRows.length}</StatValue>
          </StatCard>
          <StatCard $accent="#2E7D32">
            <StatIcon $bg="#E8F5E9" $color="#2E7D32"><DollarSign size={18} /></StatIcon>
            <StatLabel>Total Client Profit</StatLabel>
            <StatValue>{formatAmt(totalProfit)}</StatValue>
          </StatCard>
          <StatCard $accent="#875200">
            <StatIcon $bg="#FFF3E0" $color="#875200"><TrendingUp size={18} /></StatIcon>
            <StatLabel>Profitable Clients</StatLabel>
            <StatValue>{profitableCount}</StatValue>
          </StatCard>
        </StatGrid>

        {chartData.length > 0 && (
          <ChartBox>
            <ChartTitle>Profit per Client (Top 8)</ChartTitle>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45 + 30)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1C1C18' }} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} formatter={value => [`${formatCurrency(Number(value))}`, 'Profit']} />
                <Bar dataKey="profit" fill="#25432F" radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        )}

        <ReportSection>
          <SubHeader>
            <ReportTitle>Per Client P&amp;L</ReportTitle>
            <ExportBtn onClick={exportClients} disabled={clientRows.length === 0}>
              <Download size={14} /> Export CSV
            </ExportBtn>
          </SubHeader>
          {clientRows.length > 0 ? (
            <Table>
              <thead>
                <tr><Th>Client</Th><Th style={{ textAlign: 'right' }}>Income</Th><Th style={{ textAlign: 'right' }}>Expenses</Th><Th style={{ textAlign: 'right' }}>Profit</Th><Th style={{ textAlign: 'right' }}>Margin</Th></tr>
              </thead>
              <tbody>
                {clientRows.map(r => (
                  <tr key={r.name}>
                    <Td><strong>{r.name}</strong></Td>
                    <Td style={{ textAlign: 'right' }}>{formatAmt(r.income)}</Td>
                    <Td style={{ textAlign: 'right' }}>{formatAmt(r.expenses)}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700, color: r.profit >= 0 ? '#25432F' : '#C62828' }}>{formatAmt(r.profit)}</Td>
                    <Td style={{ textAlign: 'right' }}>{r.margin}%</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState>No income or client-linked expenses in this period.</EmptyState>}
        </ReportSection>
      </>
    );
  };

  const renderOutstanding = () => {
    const totalOutstanding = outstandingRows.reduce((s, r) => s + r.balance, 0);
    const grouped = {};
    outstandingRows.forEach(r => {
      if (!grouped[r.customer]) grouped[r.customer] = [];
      grouped[r.customer].push(r);
    });
    const customerSummary = Object.entries(grouped).map(([name, rs]) => ({
      name,
      count: rs.length,
      total: rs.reduce((s, r) => s + r.balance, 0),
      oldest: rs.map(r => r.date).filter(Boolean).sort()[0] || '',
    })).sort((a, b) => b.total - a.total);

    const todayIso = todayISO();
    const overdueCount = outstandingRows.filter(r => r.date && r.date < todayIso).length;

    return (
      <>
        <StatGrid>
          <StatCard $accent="#C62828">
            <StatIcon $bg="#FFEBEE" $color="#C62828"><Wallet size={18} /></StatIcon>
            <StatLabel>Total Outstanding</StatLabel>
            <StatValue>{formatAmt(totalOutstanding)}</StatValue>
          </StatCard>
          <StatCard $accent="#875200">
            <StatIcon $bg="#FFF3E0" $color="#875200"><AlertCircle size={18} /></StatIcon>
            <StatLabel>Open Items</StatLabel>
            <StatValue>{outstandingRows.length}</StatValue>
          </StatCard>
          <StatCard $accent="#BA1A1A">
            <StatIcon $bg="#FFF0F0" $color="#BA1A1A"><TrendingDown size={18} /></StatIcon>
            <StatLabel>Overdue</StatLabel>
            <StatValue>{overdueCount}</StatValue>
          </StatCard>
        </StatGrid>

        <ReportSection>
          <ReportTitle>By Customer</ReportTitle>
          {customerSummary.length > 0 ? (
            <Table>
              <thead>
                <tr><Th>Customer</Th><Th style={{ textAlign: 'right' }}>Open Items</Th><Th>Oldest Due</Th><Th style={{ textAlign: 'right' }}>Outstanding</Th></tr>
              </thead>
              <tbody>
                {customerSummary.map(c => (
                  <tr key={c.name}>
                    <Td><strong>{c.name}</strong></Td>
                    <Td style={{ textAlign: 'right' }}>{c.count}</Td>
                    <Td>{c.oldest || '-'}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700, color: '#C62828' }}>{formatAmt(c.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState>Nothing outstanding â€” all invoices are settled.</EmptyState>}
        </ReportSection>

        <ReportSection>
          <SubHeader>
            <ReportTitle>Outstanding Items</ReportTitle>
            <ExportBtn onClick={exportOutstanding} disabled={outstandingRows.length === 0}>
              <Download size={14} /> Export CSV
            </ExportBtn>
          </SubHeader>
          {outstandingRows.length > 0 ? (
            <Table>
              <thead>
                <tr><Th>Customer</Th><Th>Service</Th><Th>Invoice #</Th><Th>Date</Th><Th style={{ textAlign: 'right' }}>Billed</Th><Th style={{ textAlign: 'right' }}>Paid</Th><Th style={{ textAlign: 'right' }}>Balance</Th></tr>
              </thead>
              <tbody>
                {outstandingRows.map(r => (
                  <tr key={r.invoiceId}>
                    <Td><strong>{r.customer}</strong></Td>
                    <Td>{r.service}</Td>
                    <Td>{r.invoiceId}</Td>
                    <Td>{r.date || '-'}</Td>
                    <Td style={{ textAlign: 'right' }}>{formatAmt(r.amount)}</Td>
                    <Td style={{ textAlign: 'right' }}>{formatAmt(r.paid)}</Td>
                    <Td style={{ textAlign: 'right', fontWeight: 700, color: '#C62828' }}>{formatAmt(r.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState>No outstanding items.</EmptyState>}
        </ReportSection>
      </>
    );
  };

  return (
    <Container>
      <Title>Reports</Title>

      <Tabs>
        <Tab $active={tab === 'overview'} onClick={() => setTab('overview')}>P&L Overview</Tab>
        <Tab $active={tab === 'clients'} onClick={() => setTab('clients')}>Per Client P&L</Tab>
        <Tab $active={tab === 'outstanding'} onClick={() => setTab('outstanding')}>Outstanding</Tab>
        <Tab $active={tab === 'customers'} onClick={() => setTab('customers')}>Customers</Tab>
      </Tabs>

      <DateRange>
        <Toolbar>
          {PRESETS.map(option => (
            <PresetButton
              key={option.key}
              type="button"
              $active={preset === option.key}
              onClick={() => applyPreset(option.key)}
            >
              {option.label}
            </PresetButton>
          ))}
          <DateInput
            type="date"
            aria-label="From date"
            value={startDate}
            max={endDate || undefined}
            onChange={e => onStartChange(e.target.value)}
          />
          <span>to</span>
          <DateInput
            type="date"
            aria-label="To date"
            value={endDate}
            min={startDate || undefined}
            onChange={e => onEndChange(e.target.value)}
          />
          <SearchBox style={{ flex: '1 1 220px' }}>
            <Search size={16} color="#89726C" />
            <input
              type="text"
              placeholder="Search client, service, platform or vendor"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setIncomePage(1); }}
            />
          </SearchBox>
        </Toolbar>
        <RowCount style={{ marginTop: '0.5rem' }}>
          Showing {rangeLabel}
          {searchTerm.trim() ? ` matching "${searchTerm.trim()}"` : ''}
        </RowCount>
      </DateRange>

      {tab === 'overview' && renderOverview()}
      {tab === 'clients' && renderClients()}
      {tab === 'outstanding' && renderOutstanding()}
      {tab === 'customers' && renderCustomers()}
    </Container>
  );
};

export default ServiceReporting;
