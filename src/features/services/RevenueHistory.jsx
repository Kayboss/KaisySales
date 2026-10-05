import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { fetchServiceIncome, fetchExpenses } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatCurrencyShort, parseAmount } from '../../utils/currency';
import { serviceRowReceived } from '../../utils/serviceFinance';
import {
  groupByMonth,
  monthKeyOf,
  monthKeyFor,
  monthLabel,
  monthBounds,
  shiftMonthKey,
  parseLocalDate,
} from '../../utils/revenueHistory';

/**
 * Services revenue history.
 *
 * Answers "how much did I make last month, or three months ago" â€” the question
 * the rolling presets on the Reports page cannot, because those are windows
 * counted back from today, so a specific calendar month is never selectable.
 *
 * Two things are deliberate:
 *
 * 1. Revenue comes only from service_income, which records money actually
 *    received against a payment_date. recurring_income is a schedule of
 *    expectation (amount + next_due_date) with no record of what was collected,
 *    so it is deliberately not counted. Counting it would report money that
 *    never arrived.
 * 2. Every figure is measured on income RECEIVED, net of platform fees, via the
 *    shared serviceRowReceived basis, so this page cannot disagree with the
 *    dashboard or the P&L report by the amount of the fees.
 */

const MONTHS_PER_PAGE = 8;

const lastNMonthKeys = (n) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
};

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const TitleBlock = styled.div`
  h1 { font-size: 2rem; color: ${({ theme }) => theme.colors.primary}; }
  p { color: ${({ theme }) => theme.colors.text.muted}; margin-top: 0.25rem; font-size: 0.9rem; }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
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

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.background.surface};
  margin-left: auto;

  input {
    border: none;
    outline: none;
    font-size: 0.85rem;
    width: 100%;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.main};
  }

  @media (max-width: 768px) { margin-left: 0; width: 100%; }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const StatCard = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
`;

const StatNote = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const ChartTitle = styled.h3`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 1rem;
`;

const MonthCard = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  margin-bottom: 1rem;
  overflow: hidden;
`;

const MonthHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  border: none;
  cursor: pointer;
  text-align: left;
  color: ${({ theme }) => theme.colors.text.main};

  &:hover { background: ${({ theme }) => theme.colors.background.surface}; }
`;

const MonthTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 0.95rem;
`;

const MonthMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;

  @media (max-width: 640px) { gap: 0.75rem; flex-wrap: wrap; }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;

  @media (max-width: 768px) { display: none; }
`;

const Th = styled.th`
  text-align: left;
  padding: 0.9rem 1.25rem;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
`;

const Td = styled.td`
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.85rem;
`;

const MobileCard = styled.div`
  display: none;

  @media (max-width: 768px) { display: block; }
`;

const MobileRow = styled.div`
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  font-size: 0.85rem;

  &:last-child { border-bottom: none; }
`;

const MobileLabel = styled.span`
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 700;
  margin-right: 0.4rem;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.background.surfaceVariant};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.72rem;
  font-weight: 700;
`;

const EmptyState = styled.div`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 1px dashed ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 3rem 1.5rem;
  text-align: center;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;
`;

const PagerButton = styled.button`
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.background.surface};
  color: ${({ theme }) => theme.colors.text.main};
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const RevenueHistory = () => {
  const currency = useSettingsStore((s) => s.currency);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [months, setMonths] = useState(() => lastNMonthKeys(6));
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([fetchServiceIncome(), fetchExpenses()])
      .then(([i, e]) => { setIncome(i); setExpenses(e); })
      .finally(() => setLoading(false));
  }, []);

  const money = (value) => formatCurrency(value, currency);

  /* Search narrows the payments *inside* each month, and the month figures are
     recomputed from what survives, so the header total always reconciles with
     the rows beneath it. */
  const grouped = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const keep = (row) => {
      if (!term) return true;
      return ['clientName', 'milestoneLabel', 'platformTag', 'category', 'notes']
        .some(field => String(row[field] ?? '').toLowerCase().includes(term));
    };
    const matchedIncome = income.filter(keep);
    const matchedExpenses = term
      ? expenses.filter(e => ['title', 'category', 'subcategory', 'vendor', 'notes']
        .some(field => String(e[field] ?? '').toLowerCase().includes(term)))
      : expenses;
    return groupByMonth(matchedIncome, matchedExpenses, serviceRowReceived);
  }, [income, expenses, searchTerm]);

  /* The month cards, the stat cards and the export must all describe the same
     window, so they are cut from `grouped` by the selected span. Without this
     the window controls only moved the chart while the list below kept showing
     every month ever recorded. */
  const windowKeys = useMemo(() => new Set(months), [months]);
  const inWindow = useMemo(() => grouped.filter(month => windowKeys.has(month.key)), [grouped, windowKeys]);

  const visible = useMemo(() => inWindow.slice(0, page * MONTHS_PER_PAGE), [inWindow, page]);
  const hasMore = inWindow.length > page * MONTHS_PER_PAGE;
  const loadedAll = inWindow.length > 0 && inWindow.length <= page * MONTHS_PER_PAGE;

  const totals = useMemo(() => inWindow.reduce((acc, month) => ({
    received: acc.received + month.received,
    expenses: acc.expenses + month.spent,
    fees: acc.fees + month.fees,
  }), { received: 0, expenses: 0, fees: 0 }), [inWindow]);

  const bestMonth = useMemo(
    () => inWindow.reduce((best, month) => (month.received > (best?.received ?? -1) ? month : best), null),
    [inWindow],
  );

  /* Bar chart over the selected months only, oldest first so time reads
     left-to-right. Months with no rows are not padded into the chart: a
     fabricated zero bar reads as a real figure. */
  const chartData = useMemo(() => {
    const byKey = new Map(inWindow.map(month => [month.key, month]));
    return months
      .map(key => byKey.get(key))
      .filter(Boolean)
      .slice()
      .reverse()
      .map(month => ({ name: monthLabel(month.key), received: parseFloat(month.received.toFixed(2)), key: month.key }));
  }, [months, inWindow]);

  const toggleMonth = (key) => setExpanded(current => (current === key ? null : key));

  const jump = (delta) => {
    setMonths(current => {
      const anchor = current[0];
      const next = shiftMonthKey(anchor, delta);
      // Walk a contiguous run ending at the anchor so stepping back and forth
      // through the picker returns to the same span.
      return Array.from({ length: 6 }, (_, i) => shiftMonthKey(next, -(5 - i)));
    });
    setExpanded(null);
    // A stale page number would hide the first months of the new window
    // entirely, so the window is always entered from its most recent month.
    setPage(1);
  };

  const pickMonths = (n) => { setMonths(lastNMonthKeys(n)); setExpanded(null); setPage(1); };

  const isDefaultSpan = months.join() === lastNMonthKeys(6).join();

  const exportMonths = () => {
    const rows = months.map(key => {
      const month = inWindow.find(m => m.key === key);
      const bounds = monthBounds(key);
      return {
        month: monthLabel(key),
        start: bounds.start,
        end: bounds.end,
        payments: month ? month.count : 0,
        gross: month ? month.gross.toFixed(2) : '0.00',
        fees: month ? month.fees.toFixed(2) : '0.00',
        received: month ? month.received.toFixed(2) : '0.00',
        expenses: month ? month.spent.toFixed(2) : '0.00',
        profit: month ? month.profit.toFixed(2) : '0.00',
        margin: month && month.margin !== null ? `${month.margin}%` : 'n/a',
      };
    });
    downloadCSV(
      convertToCSV(rows, {
        month: 'Month', start: 'First Day', end: 'Last Day', payments: 'Payments',
        gross: 'Gross Billed', fees: 'Platform Fees', received: 'Net Received',
        expenses: 'Expenses', profit: 'Profit', margin: 'Margin',
      }),
      `Service_Revenue_History_${months[months.length - 1]}_to_${months[0]}.csv`,
    );
  };

  if (loading) {
    return <EmptyState>Loading revenue history...</EmptyState>;
  }

  return (
    <>
      <Header>
        <TitleBlock>
          <h1>Revenue History</h1>
          <p>Month by month, what came in and what it cost you to earn it.</p>
        </TitleBlock>
        <ActionButton type="button" onClick={exportMonths} disabled={inWindow.length === 0}>
          <Download size={16} /> Export CSV
        </ActionButton>
      </Header>

      <Toolbar>
        <PresetButton type="button" $active={isDefaultSpan} onClick={() => pickMonths(6)}>Last 6 months</PresetButton>
        <PresetButton type="button" $active={!isDefaultSpan} onClick={() => pickMonths(12)}>Last 12 months</PresetButton>
        <PagerButton type="button" onClick={() => jump(-6)} title="Six months earlier">
          <Calendar size={14} /> Back 6 months
        </PagerButton>
        <PagerButton type="button" onClick={() => jump(6)} disabled={isDefaultSpan} title="Six months later">
          Later <ChevronRight size={14} />
        </PagerButton>
        <SearchBox>
          <Search size={15} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Search client, service, platform..."
          />
        </SearchBox>
      </Toolbar>

      <StatsGrid>
        <StatCard>
          <StatLabel>Total Received</StatLabel>
          <StatValue>{money(totals.received)}</StatValue>
          <StatNote>
            {totals.fees > 0 ? `After ${formatCurrencyShort(totals.fees, currency)} in platform fees` : 'Across the months shown'}
          </StatNote>
        </StatCard>
        <StatCard>
          <StatLabel>Expenses</StatLabel>
          <StatValue>{money(totals.expenses)}</StatValue>
          <StatNote>Paid out in the same months</StatNote>
        </StatCard>
        <StatCard>
          <StatLabel>Best Month</StatLabel>
          <StatValue>{bestMonth ? bestMonth.label : 'â€”'}</StatValue>
          <StatNote>{bestMonth ? money(bestMonth.received) : 'No payments recorded yet'}</StatNote>
        </StatCard>
        <StatCard>
          <StatLabel>Months Recorded</StatLabel>
          <StatValue>{inWindow.length}</StatValue>
          <StatNote>{months[months.length - 1]} to {months[0]}</StatNote>
        </StatCard>
      </StatsGrid>

      {chartData.length > 0 && (
        <ChartCard>
          <ChartTitle>Income received by month</ChartTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE8" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={{ stroke: '#E8E5DF' }} />
              <YAxis tick={{ fontSize: 11, fill: '#89726C' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E8E5DF', fontSize: 13 }}
                formatter={(value) => [formatCurrency(Number(value), currency), 'Received']}
              />
              <Bar dataKey="received" radius={[6, 6, 0, 0]}>
                {chartData.map(entry => (
                  <Cell
                    key={entry.key}
                    fill={entry.key === expanded ? '#8E3A1F' : '#6F240A'}
                    cursor="pointer"
                    onClick={() => toggleMonth(entry.key)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {visible.length === 0 ? (
        <EmptyState>
          {searchTerm
            ? 'No payments match that search in these months.'
            : 'No payments recorded in these months yet. Add income from your dashboard and it will appear here.'}
        </EmptyState>
      ) : (
        visible.map(month => (
          <MonthCard key={month.key}>
            <MonthHeader
              type="button"
              onClick={() => toggleMonth(month.key)}
              aria-expanded={expanded === month.key}
            >
              <MonthTitle>
                <TrendingUp size={16} />
                {month.label}
                <Badge>{month.count} {month.count === 1 ? 'payment' : 'payments'}</Badge>
              </MonthTitle>
              <MonthMeta>
                <span>Received {money(month.received)}</span>
                {month.spent > 0 && <span>Expenses {money(month.spent)}</span>}
                <span style={{ color: month.profit >= 0 ? '#25432F' : '#BA1A1A' }}>
                  {month.profit >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {money(month.profit)}
                </span>
                <ChevronDown
                  size={16}
                  style={{ transform: expanded === month.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
              </MonthMeta>
            </MonthHeader>

            {expanded === month.key && (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Client</Th>
                      <Th>Service</Th>
                      <Th>Platform</Th>
                      <Th style={{ textAlign: 'right' }}>Gross</Th>
                      <Th style={{ textAlign: 'right' }}>Fee</Th>
                      <Th style={{ textAlign: 'right' }}>Received</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...month.income]
                      .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))
                      .map(row => (
                        <tr key={row.id}>
                          <Td>{monthKeyFor(row.paymentDate)
                            ? parseLocalDate(row.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : row.paymentDate}</Td>
                          <Td>{row.clientName || 'â€”'}</Td>
                          <Td>{row.milestoneLabel || row.description || 'â€”'}</Td>
                          <Td>{row.platformTag ? <Badge>{row.platformTag}</Badge> : 'Direct'}</Td>
                          <Td style={{ textAlign: 'right' }}>{money(parseAmount(row.amount))}</Td>
                          <Td style={{ textAlign: 'right' }}>{money(parseAmount(row.platformFee))}</Td>
                          <Td style={{ textAlign: 'right', fontWeight: 700 }}>{money(serviceRowReceived(row))}</Td>
                        </tr>
                      ))}
                  </tbody>
                </Table>

                <MobileCard>
                  {[...month.income]
                    .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))
                    .map(row => (
                      <MobileRow key={row.id}>
                        <div>
                          <MobileLabel>Client:</MobileLabel>
                          {row.clientName || 'â€”'}
                        </div>
                        <div>
                          <MobileLabel>Service:</MobileLabel>
                          {row.milestoneLabel || row.description || 'â€”'}
                        </div>
                        <div>
                          <MobileLabel>Received:</MobileLabel>
                          {money(serviceRowReceived(row))}
                        </div>
                      </MobileRow>
                    ))}
                </MobileCard>
              </>
            )}
          </MonthCard>
        ))
      )}

      {inWindow.length > 0 && (hasMore || page > 1) && (
        <Pager>
          <PagerButton type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Show less
          </PagerButton>
          <span>
            Showing {Math.min(page * MONTHS_PER_PAGE, inWindow.length)} of {inWindow.length} months
          </span>
          <PagerButton type="button" onClick={() => setPage(p => p + 1)} disabled={!hasMore}>
            Show more
          </PagerButton>
        </Pager>
      )}

      {loadedAll && inWindow.length > MONTHS_PER_PAGE && (
        <StatNote style={{ textAlign: 'center', marginTop: '1rem' }}>
          Showing every month with recorded payments. Months with no payments are omitted.
        </StatNote>
      )}
    </>
  );
};

export default RevenueHistory;