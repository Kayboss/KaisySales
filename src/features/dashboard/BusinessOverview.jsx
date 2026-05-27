import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { TrendingUp, ShoppingBag, CreditCard, Package, ArrowUpRight, AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import { fetchSales, fetchExpenses, fetchInvoices, fetchInventory } from '../../services/api';
import TutorialModal, { STORAGE_KEY } from '../../components/tutorial/TutorialModal';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 3rem;

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
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: ${props => props.$color || props.theme.colors.primary};
    opacity: 0.2;
  }
`;

const IconWrapper = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.$bg || 'rgba(111, 36, 10, 0.05)'};
  color: ${props => props.$color || props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
`;

const Value = styled.div`
  font-size: 1.75rem;
  font-weight: 800;
  font-family: ${({ theme }) => theme.fonts.display};
  color: ${({ theme }) => theme.colors.primary};
  
  @media (max-width: 768px) {
    font-size: 1.35rem;
  }
`;

const Label = styled.div`
  color: ${({ theme }) => theme.textMuted};
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const ChartContainer = styled.div`
  background: white;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  box-shadow: ${({ theme }) => theme.shadows.soft};
`;

const getBezierPath = (points) => {
  if (points.length === 0) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 3;
    const cpY1 = p0.y;
    const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
    const cpY2 = p1.y;
    d += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
  }
  return d;
};

const getMonthlyData = (sales, invoices) => {
  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('default', { month: 'short' }).toUpperCase();
    months.push({ key: `${year}-${month}`, label, amount: 0 });
  }

  sales.forEach(s => {
    if (s.date) {
      const key = s.date.substring(0, 7);
      const match = months.find(m => m.key === key);
      if (match) {
        match.amount += parseAmount(s.totalAmount || s.amount);
      }
    }
  });

  invoices.forEach(inv => {
    if (inv.date && inv.status?.toLowerCase() === 'paid') {
      const key = inv.date.substring(0, 7);
      const match = months.find(m => m.key === key);
      if (match) {
        match.amount += parseAmount(inv.amount || inv.totalAmount);
      }
    }
  });

  return months;
};

const GrowthChart = ({ data }) => {
  const maxAmount = Math.max(...data.map(item => item.amount), 0);
  const points = data.map((d, i) => {
    const x = 50 + i * 140; // Spacing: 50, 190, 330, 470, 610, 750
    const amount = d.amount;
    const y = maxAmount > 0 ? 160 - (amount / maxAmount) * 130 : 160;
    return { x, y, label: d.label, amount };
  });

  const linePath = getBezierPath(points);
  const fillPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x},180 L ${points[0].x},180 Z` : '';

  return (
    <svg viewBox="0 0 800 220" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Grid Lines */}
      <line x1="50" y1="180" x2="750" y2="180" stroke="#F0EEE8" strokeWidth="1" />
      <line x1="50" y1="115" x2="750" y2="115" stroke="#F0EEE8" strokeWidth="1" />
      <line x1="50" y1="50" x2="750" y2="50" stroke="#F0EEE8" strokeWidth="1" />
      
      {/* Gradient Area */}
      <defs>
        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6F240A" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6F240A" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {fillPath && <path d={fillPath} fill="url(#growthGradient)" />}
      
      {/* Smooth Line */}
      {linePath && (
        <path 
          d={linePath} 
          fill="none" 
          stroke="#6F240A" 
          strokeWidth="3" 
          strokeLinecap="round"
          className="chart-line"
        />
      )}
      
      {/* Interactive Dots and Labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#6F240A" />
          {i === points.length - 1 && (
            <circle cx={p.x} cy={p.y} r="7" fill="#875200" stroke="white" strokeWidth="2.5" />
          )}
          {/* Amount indicator above dot */}
          <text 
            x={p.x} 
            y={p.y - 12} 
            textAnchor="middle" 
            fontSize="10" 
            fontWeight="bold" 
            fill="#6F240A"
          >
            GH₵{p.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </text>
          {/* Month Label */}
          <text 
            x={p.x} 
            y="200" 
            textAnchor="middle" 
            fontSize="10" 
            fontWeight="700" 
            fill="#89726C"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

const AlertBanner = styled.div`
  background: #FFF2F2;
  border: 1px solid #FFDAD6;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  animation: slideDown 0.4s ease-out;

  @keyframes slideDown {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const AlertContent = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #410002;
  font-weight: 600;
`;

const RestockLink = styled.button`
  background: #BA1A1A;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #93000A;
  }
`;

const BusinessOverview = () => {
  const [showTutorial, setShowTutorial] = useState(false);
  const [stats, setStats] = useState({
    revenue: 0,
    salesToday: 0,
    netProfit: 0,
    lowStock: 0,
    monthlyData: [],
    loading: true
  });

  const parseAmount = (amt) => {
    if (typeof amt === 'number') return amt;
    if (typeof amt !== 'string') return 0;
    return parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
  };

  const loadStats = async () => {
    try {
      const [sales, expenses, invoices, inventory] = await Promise.all([
        fetchSales(),
        fetchExpenses(),
        fetchInvoices(),
        fetchInventory()
      ]);

      const today = new Date().toISOString().split('T')[0];
      
      // Revenue: All sales + Paid invoices
      const salesRevenue = sales.reduce((acc, s) => acc + parseAmount(s.totalAmount || s.amount), 0);
      const invoiceRevenue = invoices
        .filter(inv => inv.status?.toLowerCase() === 'paid')
        .reduce((acc, inv) => acc + parseAmount(inv.amount || inv.totalAmount), 0);
      const totalRevenue = salesRevenue + invoiceRevenue;

      // Sales Today: Count of sales + invoices today
      const salesTodayCount = sales.filter(s => s.date === today).length + 
                             invoices.filter(inv => inv.date === today).length;

      // Net Profit: Total Revenue - Total Expenses
      const totalExpenses = expenses.reduce((acc, e) => acc + parseAmount(e.amount || e.totalAmount), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Low Stock: Inventory items with status "Low Stock"
      const lowStockCount = inventory.filter(item => item.status === 'Low Stock').length;

      // Compute monthly dynamic performance trends
      const monthlyData = getMonthlyData(sales, invoices);

      setStats({
        revenue: totalRevenue,
        salesToday: salesTodayCount,
        netProfit: netProfit,
        lowStock: lowStockCount,
        monthlyData: monthlyData,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load dashboard stats', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadStats();

    if (!localStorage.getItem(STORAGE_KEY)) {
      setShowTutorial(true);
    }

    const interval = setInterval(loadStats, 30000);

    const handleFocus = () => loadStats();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (stats.loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#89726C' }}>Loading your business overview...</div>;
  }

  return (
    <div>
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Business Dashboard</h1>
          <p style={{ color: '#55423D' }}>Your revenue, sales, and growth at a glance.</p>
        </div>
        <button onClick={() => setShowTutorial(true)} style={{ background: 'white', border: '1px solid #E0D6D0', borderRadius: '20px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6F240A' }}>
          <BookOpen size={14} /> Tutorial
        </button>
      </header>

      {stats.lowStock > 0 && (
        <AlertBanner>
          <AlertContent>
            <AlertTriangle size={20} color="#BA1A1A" />
            <span>You have {stats.lowStock} items running low on stock.</span>
          </AlertContent>
          <RestockLink onClick={() => window.location.hash = '#/inventory'}>
            Restock Now
            <ArrowRight size={16} />
          </RestockLink>
        </AlertBanner>
      )}

      <Grid>
        <StatCard>
          <IconWrapper><TrendingUp size={20} /></IconWrapper>
          <Label>Total Revenue</Label>
          <Value className="data-tabular">GH₵{stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Value>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#25432F', fontSize: '0.75rem', fontWeight: 700 }}>
            <ArrowUpRight size={14} /> Live Sync
          </div>
        </StatCard>
        <StatCard $color="#875200">
          <IconWrapper $bg="rgba(135, 82, 0, 0.05)" $color="#875200"><ShoppingBag size={20} /></IconWrapper>
          <Label>Sales Today</Label>
          <Value className="data-tabular">{stats.salesToday}</Value>
          <div style={{ color: '#55423D', fontSize: '0.75rem', fontWeight: 600 }}>Real-time transactions</div>
        </StatCard>
        <StatCard $color="#25432F">
          <IconWrapper $bg="rgba(37, 67, 47, 0.05)" $color="#25432F"><CreditCard size={20} /></IconWrapper>
          <Label>Net Profit</Label>
          <Value className="data-tabular">GH₵{stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Value>
          <div style={{ color: stats.netProfit >= 0 ? '#25432F' : '#BA1A1A', fontSize: '0.75rem', fontWeight: 700 }}>
            {stats.netProfit >= 0 ? 'Healthy Margin' : 'Action Required'}
          </div>
        </StatCard>
        <StatCard $color="#BA1A1A">
          <IconWrapper $bg="rgba(186, 26, 26, 0.05)" $color="#BA1A1A"><Package size={20} /></IconWrapper>
          <Label>Low Stock Items</Label>
          <Value className="data-tabular">{stats.lowStock}</Value>
          <div style={{ color: '#BA1A1A', fontSize: '0.75rem', fontWeight: 700 }}>
            {stats.lowStock > 0 ? 'Action Required' : 'Fully Stocked'}
          </div>
        </StatCard>
      </Grid>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem' }}>Revenue Growth</h2>
            <p style={{ color: '#55423D', fontSize: '0.875rem' }}>Monthly sales performance</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#1C1C18', fontWeight: 600 }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#6F240A' }}></span>
              Current Year
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#89726C' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#F0EEE8' }}></span>
              Previous
            </div>
          </div>
        </div>
        
        <ChartContainer>
          <GrowthChart data={stats.monthlyData} />
        </ChartContainer>
      </section>

      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        autoShow
      />
    </div>
  );
};

export default BusinessOverview;
