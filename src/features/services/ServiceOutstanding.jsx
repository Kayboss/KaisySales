import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { AlertCircle, Download, Search, TrendingDown, Wallet } from 'lucide-react';
import { fetchInvoices, fetchServiceIncome } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency } from '../../utils/currency';
import { buildOutstandingRows, summariseByCustomer, countOverdue, isOverdue } from '../../utils/serviceOutstanding';

/**
 * Outstanding balances, as its own page.
 *
 * Previously a tab inside Reports. It was split out because chasing money owed
 * is a recurring task an owner does on its own, not one they go looking for
 * under a P&L report, and burying it one tab deep made it easy to miss.
 *
 * The figures come from serviceOutstanding, the same helpers the Reports page
 * uses, so the two screens cannot disagree.
 *
 * Payments are matched against ALL income regardless of the date filter below.
 * An invoice settled today is settled; showing it as overdue because the owner
 * narrowed the range to last month would be wrong. The date filter therefore
 * chooses WHICH invoices are in scope, never which payments count.
 */

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
`;

const TitleBlock = styled.div`
  h1 { font-size: 1.5rem; color: ${({ theme }) => theme.colors.primary}; }
  p { color: ${({ theme }) => theme.colors.text.muted}; margin-top: 0.25rem; font-size: 0.85rem; }
`;

const ExportBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.main};

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

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
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.background.surface)};
  color: ${({ theme, $active }) => ($active ? theme.colors.text.onPrimary : theme.colors.text.muted)};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const DateInput = styled.input`
  padding: 0.5rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  font-size: 0.85rem;
  background: ${({ theme }) => theme.colors.background.surface};
  color: ${({ theme }) => theme.colors.text.main};
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.background.surface};
  flex: 1 1 200px;

  input {
    border: none;
    outline: none;
    font-size: 0.85rem;
    width: 100%;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.main};
  }
`;

const RowCount = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
`;

const StatCard = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid ${({ $accent }) => $accent};
`;

const StatIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  color: ${({ $color }) => $color};
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

const ReportSection = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
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

/* The <Table> hides itself below 768px, so each table needs a card layout
   behind it or the data simply disappears on a phone. */
const MobileList = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const MobileRow = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 8px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
`;

const MobileHead = styled.div`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const MobileLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: ${({ theme }) => theme.colors.text.main};
`;

const MobileMuted = styled.span`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.8rem;
`;

const Note = styled.div`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
`;

const todayISO = () => new Date().toISOString().split('T')[0];

const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

const shiftDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

/* "All time" is the default here, unlike Reports. A balance is a fact about
   now, so narrowing the range should be a deliberate act, not the first thing
   the page does. */
const PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: '90', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
];

const ServiceOutstanding = () => {
  const currency = useSettingsStore((s) => s.currency);
  const [invoices, setInvoices] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchServiceIncome()])
      .then(([inv, inc]) => { setInvoices(inv); setIncome(inc); })
      .finally(() => setLoading(false));
  }, []);

  const money = (value) => formatCurrency(value, currency);

  const applyPreset = (key) => {
    setPreset(key);
    const today = todayISO();
    if (key === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(today);
    } else if (key === '90') {
      setStartDate(shiftDays(today, -89));
      setEndDate(today);
    } else if (key === 'year') {
      setStartDate(`${today.slice(0, 4)}-01-01`);
      setEndDate(today);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  /* The date range selects which INVOICES are in scope. Payments are always
     matched against the full income set — see the note at the top. */
  const rows = useMemo(() => {
    const scoped = invoices.filter(invoice => {
      if (!startDate && !endDate) return true;
      if (!invoice.date) return false;
      if (startDate && invoice.date < startDate) return false;
      if (endDate && invoice.date > endDate) return false;
      return true;
    });
    const built = buildOutstandingRows(scoped, income);
    const term = searchTerm.trim().toLowerCase();
    if (!term) return built;
    return built.filter(row => ['customer', 'service', 'invoiceId', 'date']
      .some(field => String(row[field] ?? '').toLowerCase().includes(term)));
  }, [invoices, income, startDate, endDate, searchTerm]);

  const customerSummary = useMemo(() => summariseByCustomer(rows), [rows]);
  const todayIso = todayISO();
  const overdueCount = useMemo(() => countOverdue(rows, todayIso), [rows, todayIso]);
  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);

  const rangeLabel = startDate || endDate
    ? `invoices raised ${startDate || 'start'} to ${endDate || 'today'}`
    : 'all recorded invoices';

  const exportRows = () => {
    downloadCSV(
      convertToCSV(rows.map(r => ({
        customer: r.customer,
        service: r.service,
        invoice: r.invoiceId,
        date: r.date || '',
        billed: r.amount.toFixed(2),
        paid: r.paid.toFixed(2),
        balance: r.balance.toFixed(2),
        status: isOverdue(r, todayIso) ? 'Overdue' : 'Open',
      })), {
        customer: 'Customer', service: 'Service', invoice: 'Invoice #', date: 'Date',
        billed: 'Billed', paid: 'Paid', balance: 'Balance', status: 'Status',
      }),
      `Service_Outstanding_${startDate || 'all'}_to_${endDate || 'today'}.csv`,
    );
  };

  if (loading) return <EmptyState>Loading outstanding balances...</EmptyState>;

  return (
    <Container>
      <Header>
        <TitleBlock>
          <h1>Outstanding</h1>
          <p>What customers still owe you, and what has gone past its date.</p>
        </TitleBlock>
        <ExportBtn type="button" onClick={exportRows} disabled={rows.length === 0}>
          <Download size={14} /> Export CSV
        </ExportBtn>
      </Header>

      <StatGrid>
        <StatCard $accent="#C62828">
          <StatIcon $bg="#FFEBEE" $color="#C62828"><Wallet size={18} /></StatIcon>
          <StatLabel>Total Outstanding</StatLabel>
          <StatValue>{money(totalOutstanding)}</StatValue>
        </StatCard>
        <StatCard $accent="#875200">
          <StatIcon $bg="#FFF3E0" $color="#875200"><AlertCircle size={18} /></StatIcon>
          <StatLabel>Open Items</StatLabel>
          <StatValue>{rows.length}</StatValue>
        </StatCard>
        <StatCard $accent="#BA1A1A">
          <StatIcon $bg="#FFF0F0" $color="#BA1A1A"><TrendingDown size={18} /></StatIcon>
          <StatLabel>Overdue</StatLabel>
          <StatValue>{overdueCount}</StatValue>
        </StatCard>
      </StatGrid>

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
          onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
        />
        <span>to</span>
        <DateInput
          type="date"
          aria-label="To date"
          value={endDate}
          min={startDate || undefined}
          onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
        />
        <SearchBox>
          <Search size={16} color="#89726C" />
          <input
            type="text"
            placeholder="Search customer, service or invoice #"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </SearchBox>
      </Toolbar>

      <RowCount>
        Showing {rangeLabel}
        {searchTerm.trim() ? ` matching "${searchTerm.trim()}"` : ''}
        <Note> — payments are matched against all recorded income, so a settled invoice never reappears as overdue</Note>
      </RowCount>

      <ReportSection>
        <ReportTitle>By Customer</ReportTitle>
        {customerSummary.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th style={{ textAlign: 'right' }}>Open Items</Th>
                <Th>Oldest Due</Th>
                <Th style={{ textAlign: 'right' }}>Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {customerSummary.map(c => (
                <tr key={c.name}>
                  <Td><strong>{c.name}</strong></Td>
                  <Td style={{ textAlign: 'right' }}>{c.count}</Td>
                  <Td>{c.oldest || '-'}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700, color: '#C62828' }}>{money(c.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>Nothing outstanding — all invoices are settled.</EmptyState>}

          {customerSummary.length > 0 && (
            <MobileList>
              {customerSummary.map(c => (
                <MobileRow key={c.name}>
                  <MobileHead>{c.name}</MobileHead>
                  <MobileLine><MobileMuted>Open items</MobileMuted><span>{c.count}</span></MobileLine>
                  <MobileLine><MobileMuted>Oldest due</MobileMuted><span>{c.oldest || '-'}</span></MobileLine>
                  <MobileLine><MobileMuted>Outstanding</MobileMuted><strong style={{ color: '#C62828' }}>{money(c.total)}</strong></MobileLine>
                </MobileRow>
              ))}
            </MobileList>
          )}
      </ReportSection>

      <ReportSection>
        <ReportTitle>Outstanding Items</ReportTitle>
        {rows.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th><Th>Service</Th><Th>Invoice #</Th><Th>Date</Th>
                <Th style={{ textAlign: 'right' }}>Billed</Th>
                <Th style={{ textAlign: 'right' }}>Paid</Th>
                <Th style={{ textAlign: 'right' }}>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.invoiceId}>
                  <Td><strong>{r.customer}</strong></Td>
                  <Td>{r.service}</Td>
                  <Td>{r.invoiceId}</Td>
                  <Td style={isOverdue(r, todayIso) ? { color: '#BA1A1A', fontWeight: 700 } : undefined}>
                    {r.date || '-'}
                    {isOverdue(r, todayIso) ? ' (overdue)' : ''}
                  </Td>
                  <Td style={{ textAlign: 'right' }}>{money(r.amount)}</Td>
                  <Td style={{ textAlign: 'right' }}>{money(r.paid)}</Td>
                  <Td style={{ textAlign: 'right', fontWeight: 700, color: '#C62828' }}>{money(r.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>No outstanding items.</EmptyState>}

          <MobileList>
            {rows.map(r => (
              <MobileRow key={r.invoiceId}>
                <MobileHead>{r.customer}</MobileHead>
                <MobileLine><MobileMuted>Service</MobileMuted><span>{r.service}</span></MobileLine>
                <MobileLine><MobileMuted>Invoice #</MobileMuted><span>{r.invoiceId}</span></MobileLine>
                <MobileLine>
                  <MobileMuted>Date</MobileMuted>
                  <span style={isOverdue(r, todayIso) ? { color: '#BA1A1A', fontWeight: 700 } : undefined}>
                    {r.date || '-'}{isOverdue(r, todayIso) ? ' (overdue)' : ''}
                  </span>
                </MobileLine>
                <MobileLine><MobileMuted>Billed</MobileMuted><span>{money(r.amount)}</span></MobileLine>
                <MobileLine><MobileMuted>Paid</MobileMuted><span>{money(r.paid)}</span></MobileLine>
                <MobileLine>
                  <MobileMuted>Balance</MobileMuted>
                  <strong style={{ color: '#C62828' }}>{money(r.balance)}</strong>
                </MobileLine>
              </MobileRow>
            ))}
          </MobileList>
      </ReportSection>
    </Container>
  );
};

export default ServiceOutstanding;