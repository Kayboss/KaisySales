import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  TrendingUp,
} from 'lucide-react';
import { fetchSales, fetchInventory } from '../../services/api';
import { convertToCSV, downloadCSV } from '../../utils/exportUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatCurrencyShort, parseAmount } from '../../utils/currency';

const DAYS_PER_PAGE = 10;
const PAGE_SIZE = 20;

const todayISO = () => new Date().toISOString().split('T')[0];

const shiftDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

const formatDayLabel = (iso) => {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === shiftDays(today, -1)) return 'Yesterday';
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
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
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'white')};
  color: ${({ theme, $active }) => ($active ? 'white' : theme.colors.text.muted)};
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const DateInput = styled.input`
  padding: 0.45rem 0.6rem;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  color: ${({ theme }) => theme.colors.text.primary};
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
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: white;
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

const DayCard = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
  margin-bottom: 1rem;
  overflow: hidden;
`;

const DayHeader = styled.button`
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
  color: ${({ theme }) => theme.colors.text.primary};

  &:hover { background: ${({ theme }) => theme.colors.background.surface}; }
`;

const DayTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 0.95rem;
`;

const DayMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: 600;

  @media (max-width: 640px) {
    gap: 0.75rem;
  }
`;

const SalesTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;

  @media (max-width: 768px) {
    display: none;
  }
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

  @media (max-width: 768px) {
    display: block;
  }
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
  background: white;
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

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const SalesHistory = () => {
  const { currency } = useSettingsStore();
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('7');
  const [startDate, setStartDate] = useState(shiftDays(todayISO(), -6));
  const [endDate, setEndDate] = useState(todayISO());
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const [saleRows, inventoryRows] = await Promise.all([fetchSales(), fetchInventory()]);
        setSales(Array.isArray(saleRows) ? saleRows : []);
        setInventory(Array.isArray(inventoryRows) ? inventoryRows : []);
      } catch (error) {
        console.error('Failed to load sales history', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const applyPreset = (key) => {
    setPreset(key);
    const today = todayISO();
    if (key === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (key === 'yesterday') {
      setStartDate(shiftDays(today, -1));
      setEndDate(shiftDays(today, -1));
    } else if (key === '7') {
      setStartDate(shiftDays(today, -6));
      setEndDate(today);
    } else if (key === '30') {
      setStartDate(shiftDays(today, -29));
      setEndDate(today);
    } else if (key === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(today);
    } else {
      setStartDate('');
      setEndDate('');
    }
    setPage(1);
  };

  const onStartChange = (value) => {
    setStartDate(value);
    setPreset('custom');
    setPage(1);
  };

  const onEndChange = (value) => {
    setEndDate(value);
    setPreset('custom');
    setPage(1);
  };

  const costByItem = useMemo(() => {
    const map = {};
    inventory.forEach(item => {
      map[item.name] = parseAmount(item.costPrice);
    });
    return map;
  }, [inventory]);

  const profitOf = useMemo(() => {
    return (sale) => {
      const amount = parseAmount(sale.amount || sale.totalAmount);
      const quantity = parseInt(sale.quantity) || 0;
      // A cost captured when the sale happened is authoritative; fall back to
      // the item's current cost price for sales recorded before it was stored.
      const unitCost = (sale.cost != null && sale.cost !== '')
        ? parseAmount(sale.cost)
        : (costByItem[sale.item] || 0);
      return amount - unitCost * (quantity || 1);
    };
  }, [costByItem]);

  const inRange = useMemo(() => {
    if (!startDate && !endDate) return sales;
    return sales.filter(sale => {
      const date = sale.date;
      if (!date) return false;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  }, [sales, startDate, endDate]);

  const searched = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return inRange;
    return inRange.filter(sale =>
      (sale.item || '').toLowerCase().includes(term) ||
      (sale.category || '').toLowerCase().includes(term) ||
      (sale.paymentMethod || '').toLowerCase().includes(term) ||
      String(sale.id || '').toLowerCase().includes(term)
    );
  }, [inRange, searchTerm]);

  // Grouped by calendar day, newest first, so a shop owner can open any past
  // day and see exactly what was sold on it.
  const days = useMemo(() => {
    const grouped = new Map();
    searched.forEach(sale => {
      const key = sale.date || 'Unknown date';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(sale);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, rows]) => {
        const revenue = rows.reduce((sum, sale) => sum + parseAmount(sale.amount || sale.totalAmount), 0);
        const units = rows.reduce((sum, sale) => sum + (parseInt(sale.quantity) || 0), 0);
        const profit = rows.reduce((sum, sale) => sum + profitOf(sale), 0);
        return { date, rows, revenue, units, profit };
      });
  }, [searched, profitOf]);

  const totals = useMemo(() => {
    return days.reduce((acc, day) => ({
      revenue: acc.revenue + day.revenue,
      profit: acc.profit + day.profit,
      units: acc.units + day.units,
      transactions: acc.transactions + day.rows.length,
    }), { revenue: 0, profit: 0, units: 0, transactions: 0 });
  }, [days]);

  const totalPages = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const visibleDays = days.slice((page - 1) * DAYS_PER_PAGE, page * DAYS_PER_PAGE);

  const toggleDay = (date) => {
    setCollapsedDays(previous => {
      const next = new Set(previous);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = {
      date: 'Date',
      time: 'Time',
      item: 'Item',
      category: 'Category',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      amount: 'Amount',
      grossProfit: 'Gross Profit',
      paymentMethod: 'Payment Method',
      id: 'Sale ID',
    };
    const rows = days.flatMap(day =>
      day.rows.map(sale => ({
        date: sale.date,
        time: sale.time,
        item: sale.item,
        category: sale.category,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        amount: sale.amount || sale.totalAmount,
        grossProfit: profitOf(sale).toFixed(2),
        paymentMethod: sale.paymentMethod,
        id: sale.id,
      }))
    );
    downloadCSV(convertToCSV(rows, headers), `Sales_History_${todayISO()}.csv`);
  };

  const rangeLabel = startDate || endDate
    ? `${startDate || 'start'} to ${endDate || 'today'}`
    : 'all recorded days';

  if (loading) {
    return <div style={{ color: '#55423D' }}>Loading sales history...</div>;
  }

  return (
    <div>
      <Header>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Sales History</h1>
          <p style={{ color: '#55423D' }}>
            Look back at what you sold on any day. Pick a range or search a single item.
          </p>
        </div>
        <ActionButton onClick={exportCSV} disabled={days.length === 0}
          style={{ background: days.length === 0 ? '#D0C8C4' : undefined }}>
          <Download size={18} />
          Export
        </ActionButton>
      </Header>

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
            placeholder="Search item, category or payment"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </SearchBox>
      </Toolbar>

      <StatsGrid>
        <StatCard>
          <StatLabel>Revenue</StatLabel>
          <StatValue className="data-tabular">{formatCurrencyShort(totals.revenue, currency)}</StatValue>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#25432F', fontSize: '0.75rem', fontWeight: 700 }}>
            <TrendingUp size={14} /> {rangeLabel}
          </div>
        </StatCard>
        <StatCard>
          <StatLabel>Gross Profit</StatLabel>
          <StatValue className="data-tabular" style={{ color: totals.profit >= 0 ? '#25432F' : '#BA1A1A' }}>
            {formatCurrency(totals.profit, currency)}
          </StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Revenue minus cost of goods</div>
        </StatCard>
        <StatCard>
          <StatLabel>Sales</StatLabel>
          <StatValue className="data-tabular">{totals.transactions}</StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Transactions recorded</div>
        </StatCard>
        <StatCard>
          <StatLabel>Units Sold</StatLabel>
          <StatValue className="data-tabular">{totals.units}</StatValue>
          <div style={{ color: '#89726C', fontSize: '0.75rem', fontWeight: 600 }}>Across {days.length} day(s)</div>
        </StatCard>
      </StatsGrid>

      {days.length === 0 ? (
        <EmptyState>
          <Calendar size={32} style={{ color: '#D0C8C4' }} />
          <p style={{ fontWeight: 700, color: '#55423D' }}>No sales in this range</p>
          <p style={{ fontSize: '0.85rem' }}>Try a wider date range, or record a sale on the Daily Sales page.</p>
        </EmptyState>
      ) : (
        <>
          {visibleDays.map(day => {
            const collapsed = collapsedDays.has(day.date);
            const dayRows = day.rows.slice(0, PAGE_SIZE);
            return (
              <DayCard key={day.date}>
                <DayHeader type="button" onClick={() => toggleDay(day.date)} aria-expanded={!collapsed}>
                  <DayTitle>
                    {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    {formatDayLabel(day.date)}
                  </DayTitle>
                  <DayMeta>
                    <span>{day.rows.length} sale(s)</span>
                    <span>{day.units} unit(s)</span>
                    <span style={{ color: '#1C1C18', fontWeight: 700 }}>
                      {formatCurrency(day.revenue, currency)}
                    </span>
                    <span style={{ color: day.profit >= 0 ? '#25432F' : '#BA1A1A' }}>
                      {formatCurrency(day.profit, currency)} profit
                    </span>
                  </DayMeta>
                </DayHeader>

                {!collapsed && (
                  <>
                    <SalesTable>
                      <thead>
                        <tr>
                          <Th>Time</Th>
                          <Th>Item</Th>
                          <Th>Category</Th>
                          <Th>Qty</Th>
                          <Th>Unit Price</Th>
                          <Th>Amount</Th>
                          <Th>Profit</Th>
                          <Th>Payment</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map(sale => {
                          const profit = profitOf(sale);
                          return (
                            <tr key={sale.id}>
                              <Td style={{ color: '#55423D' }}>{sale.time || '—'}</Td>
                              <Td style={{ fontWeight: 700, color: '#1C1C18' }}>{sale.item}</Td>
                              <Td>{sale.category ? <Badge>{sale.category}</Badge> : '—'}</Td>
                              <Td className="data-tabular">{sale.quantity}</Td>
                              <Td className="data-tabular">
                                {parseAmount(sale.unitPrice) > 0 ? formatCurrency(sale.unitPrice, currency) : '—'}
                              </Td>
                              <Td className="data-tabular" style={{ fontWeight: 700, color: '#1C1C18' }}>
                                {formatCurrency(sale.amount || sale.totalAmount, currency)}
                              </Td>
                              <Td className="data-tabular" style={{ color: profit >= 0 ? '#25432F' : '#BA1A1A' }}>
                                {formatCurrency(profit, currency)}
                              </Td>
                              <Td>{sale.paymentMethod || '—'}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </SalesTable>

                    <MobileCard>
                      {dayRows.map(sale => (
                        <MobileRow key={sale.id}>
                          <div>
                            <MobileLabel>Item</MobileLabel>
                            <strong>{sale.item}</strong>
                          </div>
                          <div style={{ marginTop: '0.35rem' }}>
                            <MobileLabel>Amount</MobileLabel>
                            {formatCurrency(sale.amount || sale.totalAmount, currency)}
                            <MobileLabel style={{ marginLeft: '0.75rem' }}>Qty</MobileLabel>
                            {sale.quantity}
                          </div>
                          <div style={{ marginTop: '0.35rem' }}>
                            <MobileLabel>Profit</MobileLabel>
                            <span style={{ color: profitOf(sale) >= 0 ? '#25432F' : '#BA1A1A' }}>
                              {formatCurrency(profitOf(sale), currency)}
                            </span>
                            <MobileLabel style={{ marginLeft: '0.75rem' }}>Paid</MobileLabel>
                            {sale.paymentMethod || '—'}
                          </div>
                        </MobileRow>
                      ))}
                    </MobileCard>

                    {day.rows.length > PAGE_SIZE && (
                      <div style={{ padding: '0.75rem 1.25rem', fontSize: '0.8rem', color: '#89726C', fontWeight: 600 }}>
                        Showing the first {PAGE_SIZE} of {day.rows.length} sales for this day. Export the CSV for the full list.
                      </div>
                    )}
                  </>
                )}
              </DayCard>
            );
          })}

          {totalPages > 1 && (
            <Pager>
              <PresetButton type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </PresetButton>
              <span>Page {page} of {totalPages}</span>
              <PresetButton type="button" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next
              </PresetButton>
            </Pager>
          )}
        </>
      )}
    </div>
  );
};

export default SalesHistory;
