import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { Analytics } from '@vercel/analytics/react';
import { themeTokens } from './styles/themeTokens';
import { getThemeForColor } from './styles/colorThemes';
import { GlobalStyles } from './styles/GlobalStyles';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { dbService, isSupabaseConfigured, isMockFallbackEnabled } from './services/supabase';
import { detectDevice, detectLocation } from './utils/visitTracking';
import { readTouch } from './utils/growth';
import CheckAuth from './middleware/CheckAuth';
import AdminCheck from './middleware/AdminCheck';
import ErrorBoundary from './components/common/ErrorBoundary';
import ConfigError from './components/common/ConfigError';
import IdleTimer from './components/common/IdleTimer';
import AssistantPanel from './components/assistant/AssistantPanel';
import { ASSISTANT_ENABLED } from './utils/features';

// Features
import WelcomePage from './features/auth/WelcomePage';
import BusinessOverview from './features/dashboard/BusinessOverview';
import InventoryManagement from './features/inventory/InventoryManagement';
import ExpenseTracking from './features/finance/ExpenseTracking';
import Invoices from './features/finance/Invoices';
import DailySales from './features/finance/DailySales';
import SalesHistory from './features/finance/SalesHistory';
import AutomatedReporting from './features/reporting/AutomatedReporting';
import RetailStores from './features/partners/RetailStores';
import SettingsPage from './features/settings/SettingsPage';
import HelpSupport from './features/settings/HelpSupport';
import AdminDashboard from './features/admin/AdminDashboard';

// Service business features
import Customers from './features/services/Customers';
import CustomerDetail from './features/services/CustomerDetail';
import IncomeTracking from './features/services/IncomeTracking';
import ServiceExpenses from './features/services/ServiceExpenses';
import ServiceInvoices from './features/services/ServiceInvoices';
import ServiceReporting from './features/services/ServiceReporting';
import RevenueHistory from './features/services/RevenueHistory';
import ServiceOutstanding from './features/services/ServiceOutstanding';

// Icons
import { LayoutDashboard, Package, CreditCard, ShoppingCart, LogOut, FileText, Store, Settings, Receipt, Menu, X, Users, BarChart3, Shield, History, AlertCircle, LifeBuoy } from 'lucide-react';
import { canSeeReports } from './utils/tenancy';

const Layout = styled.div`
  display: flex;
  height: 100vh;
  /* 100vh includes the area behind the mobile home indicator and the collapsing
     URL bar, so the drawer and the scroll area are sized against it. 100dvh is
     the height actually visible to the user. */
  height: 100dvh;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.background.main};
  position: relative;
`;

const Sidebar = styled.nav`
  width: 280px;
  background: ${({ theme }) => theme.colors.primary};
  display: flex;
  flex-direction: column;
  padding: 2rem;
  position: sticky;
  top: 0;
  height: 100vh;
  /* Ten nav links plus Sign Out are taller than a short laptop viewport. Let the
     rail scroll instead of pushing Sign Out past the bottom edge, where it cannot
     be reached because the rail itself does not scroll. */
  overflow-y: auto;
  z-index: 100;
  transition: transform 0.3s ease;

  @media (max-width: 768px) {
    position: fixed;
    transform: translateX(${props => props.$isOpen ? '0' : '-100%'});
    height: 100dvh;
    /* Sign Out sits at the bottom of this drawer, which lands exactly where the
       home / back / recents bar is drawn. Lift it clear of that bar. */
    padding-top: calc(2rem + env(safe-area-inset-top));
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 3rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 1.5rem;
    /* clear the fixed header, which now grows by the status-bar inset */
    padding-top: calc(5rem + env(safe-area-inset-top));
    /* the last row of a table and the Sign Out button sit right at the bottom
       edge otherwise, under the home / back / recents bar */
    padding-bottom: calc(2.5rem + env(safe-area-inset-bottom));
  }
`;

const MobileHeader = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 4rem;
    /* viewport-fit=cover lets the page draw under the status bar, so the header
       has to make room for it rather than being overlapped by the notch */
    height: calc(4rem + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
    background: ${({ theme }) => theme.colors.primary};
    padding-left: 1.5rem;
    padding-right: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    z-index: 90;
  }
`;

const Overlay = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: ${props => props.$isOpen ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 95;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 900;
  font-family: ${themeTokens.fonts.display};
  color: ${({ theme }) => theme.colors.text.onPrimary};
  margin-bottom: 3rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.onPrimary};
  display: none;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem;
  text-decoration: none;
  color: ${props => props.$active ? '#FFFFFF' : props.theme.colors.text.onPrimary};
  background: ${props => props.$active ? 'rgba(255,255,255,0.15)' : 'transparent'};
  border-radius: ${themeTokens.borderRadius.md};
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.2rem;
  transition: ${themeTokens.transitions.fast};

  &:hover {
    background: rgba(255,255,255,0.1);
    color: #FFFFFF;
  }

  @media (max-width: 768px) {
    padding: 0.65rem;
    font-size: 0.85rem;
    gap: 0.6rem;
  }
`;

// One flush per signed-in account per page load. The row is write-once on the
// server, so this is only about not repeating a round-trip that cannot change
// anything (StrictMode mounts effects twice in development).
let acquisitionFlushedFor = null;

const App = () => {
  const { user, logout } = useAuthStore();
  const {
    businessName,
    avatarColor,
    businessType,
    role,
    businessRole,
    modules,
    branches,
    activeBranchId,
    setActiveBranchId,
  } = useSettingsStore();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isServices = businessType === 'services';
  // `role` is the platform admin flag; `businessRole` is this login's role in
  // the business. Keep them separate: an admin is not automatically an owner.
  const isStaff = !isServices && businessRole === 'staff';
  // Reporting is the single staff toggle and it covers the Reporting screen,
  // Expenses, Overview totals and assistant insights. The rule itself lives in
  // utils/tenancy.js so the assistant and the nav cannot disagree. Only a staff
  // login is ever limited: an owner (and services mode, which has no staff) keeps
  // every screen.
  const canReport = isStaff ? canSeeReports({ role: businessRole, modules }) : true;
  const theme = avatarColor ? getThemeForColor(avatarColor) : themeTokens;

  const toggleMobileMenu = () => setIsMobileOpen(!isMobileOpen);
  const closeMobileMenu = () => setIsMobileOpen(false);

  useEffect(() => {
    if (user) {
      const page = location.pathname;
      const deviceType = detectDevice();
      const loc = detectLocation();
      // authStore stores the session as { uid, email } - there is no `id` field.
      // Passing user.id sent user_id: undefined, which the RLS check
      // `auth.uid() = user_id` evaluates to NULL, so every visit insert failed
      // with 42501 and nothing was ever recorded.
      dbService.trackPageVisit(user.uid, page, deviceType, loc);

      // The one moment a signup can be attributed: a user exists AND this
      // browser still remembers where it came from. Written once per account
      // (the row is write-once), so a repeat is a no-op on the server.
      if (acquisitionFlushedFor !== user.uid) {
        acquisitionFlushedFor = user.uid;
        const touch = readTouch(window.sessionStorage);
        if (touch) dbService.recordAcquisition(user.uid, touch).catch(() => {});
      }
    }
  }, [user, location.pathname]);

  const serviceNavLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/service-expenses', icon: CreditCard, label: 'Expenses' },
    { to: '/service-invoices', icon: Receipt, label: 'Invoices' },
    { to: '/service-reporting', icon: BarChart3, label: 'Reports' },
    { to: '/service-revenue-history', icon: History, label: 'Revenue History' },
    { to: '/service-outstanding', icon: AlertCircle, label: 'Outstanding' },
    { to: '/help', icon: LifeBuoy, label: 'Get Help' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const retailNavLinks = isStaff
    ? [
        ...(canReport ? [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }] : []),
        { to: '/sales', icon: ShoppingCart, label: 'Daily Sales' },
        { to: '/sales-history', icon: History, label: 'Sales History' },
        { to: '/retail-stores', icon: Store, label: 'Retail Stores' },
        ...(canReport ? [{ to: '/expenses', icon: CreditCard, label: 'Expenses' }] : []),
        { to: '/invoices', icon: Receipt, label: 'Invoices' },
        { to: '/inventory', icon: Package, label: 'Inventory' },
        ...(canReport ? [{ to: '/reporting', icon: FileText, label: 'Reporting' }] : []),
        { to: '/help', icon: LifeBuoy, label: 'Get Help' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/sales', icon: ShoppingCart, label: 'Daily Sales' },
        { to: '/sales-history', icon: History, label: 'Sales History' },
        { to: '/retail-stores', icon: Store, label: 'Retail Stores' },
        { to: '/expenses', icon: CreditCard, label: 'Expenses' },
        { to: '/invoices', icon: Receipt, label: 'Invoices' },
        { to: '/inventory', icon: Package, label: 'Inventory' },
        { to: '/reporting', icon: FileText, label: 'Reporting' },
        { to: '/help', icon: LifeBuoy, label: 'Get Help' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ];

  const navLinks = isServices ? serviceNavLinks : retailNavLinks;

  // Owner-only branch switcher. Staff are pinned to one branch by the database,
  // so showing them a picker would only produce empty screens.
  const showBranchSwitcher = !isServices && businessRole === 'owner' && branches.length > 1;

  // A production build without Supabase credentials must not run. Falling back to
  // localStorage would accept a sign-in and keep real records in one browser, so
  // the routes are never mounted and no component can read or write data.
  if (!isSupabaseConfigured && !isMockFallbackEnabled) {
    return <ConfigError />;
  }

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <GlobalStyles />
        <Analytics />
        <Routes>
          <Route path="/login" element={!user ? <WelcomePage /> : <Navigate to="/" />} />
          
          <Route element={<CheckAuth />}>
            <Route path="/*" element={
              <Layout>
                <MobileHeader>
<Logo style={{ marginBottom: 0 }}>
  <span style={{ fontWeight: 900 }}>{businessName || 'KaisySales'}</span>
</Logo>
                  <button onClick={toggleMobileMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFFFFF' }}>
                    <Menu size={24} />
                  </button>
                </MobileHeader>

                <Overlay $isOpen={isMobileOpen} onClick={closeMobileMenu} />

                <Sidebar $isOpen={isMobileOpen}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                    <Logo style={{ marginBottom: 0 }}>
                      <span style={{ fontWeight: 900 }}>{businessName || 'KaisySales'}</span>
                    </Logo>
                    <CloseButton onClick={closeMobileMenu}>
                      <X size={24} />
                    </CloseButton>
                  </div>
                  
                  {navLinks.map(link => (
                    <NavLink key={link.to} to={link.to} $active={location.pathname === link.to} onClick={closeMobileMenu}>
                      <link.icon size={20} />
                      {link.label}
                    </NavLink>
                  ))}
                  {role === 'admin' && (
                    <NavLink to="/admin" $active={location.pathname === '/admin'} onClick={closeMobileMenu} style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                      <Shield size={20} />
                      Admin Dashboard
                    </NavLink>
                  )}
                  {showBranchSwitcher && (
                    <div style={{ marginTop: '1rem' }}>
                      <label
                        htmlFor="branch-switcher"
                        style={{
                          display: 'block',
                          fontSize: '0.7rem',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.6)',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        Viewing branch
                      </label>
                      <select
                        id="branch-switcher"
                        value={activeBranchId == null ? '' : String(activeBranchId)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setActiveBranchId(value === '' ? null : Number(value));
                        }}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.65rem',
                          borderRadius: themeTokens.borderRadius.md,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.12)',
                          color: '#FFFFFF',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="" style={{ color: '#1C1B1F' }}>All branches</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={String(branch.id)} style={{ color: '#1C1B1F' }}>
                            {branch.name}{branch.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ marginTop: 'auto' }}>
                    <button 
                      onClick={logout}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.65rem', 
                        padding: '0.7rem', 
                        background: 'none', 
                        border: 'none', 
                        color: 'rgba(255,255,255,0.85)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        borderRadius: '8px',
                        width: '100%'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    >
                      <LogOut size={20} />
                      Sign Out
                    </button>
                  </div>
                </Sidebar>
                <Main>
                  <IdleTimer />
                  {/* Re-mount the screen when the owner changes branch so every
                      list refetches against the new scope. */}
                  <Routes key={`${activeBranchId ?? 'all'}`}>
                    {isServices ? (
                      <>
                        <Route index element={<IncomeTracking />} />
                        <Route path="income" element={<IncomeTracking />} />
                        <Route path="customers/:id" element={<CustomerDetail />} />
                        <Route path="customers" element={<Customers />} />
                        <Route path="service-expenses" element={<ServiceExpenses />} />
                        <Route path="service-invoices" element={<ServiceInvoices />} />
                        <Route path="service-reporting" element={<ServiceReporting />} />
                        <Route path="service-revenue-history" element={<RevenueHistory />} />
                        <Route path="service-outstanding" element={<ServiceOutstanding />} />
                        <Route path="help" element={<HelpSupport />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="*" element={<IncomeTracking />} />
                      </>
                    ) : (
                      <>
                        <Route index element={canReport ? <BusinessOverview /> : <Navigate to="/sales" replace />} />
                        <Route path="inventory" element={<InventoryManagement />} />
                        <Route path="sales" element={<DailySales />} />
                        <Route path="sales-history" element={<SalesHistory />} />
                        <Route path="invoices" element={<Invoices />} />
                        <Route path="expenses" element={canReport ? <ExpenseTracking /> : <Navigate to="/sales" replace />} />
                        <Route path="reporting" element={canReport ? <AutomatedReporting /> : <Navigate to="/sales" replace />} />
                        <Route path="retail-stores" element={<RetailStores />} />
                        <Route path="help" element={<HelpSupport />} />
                        <Route path="settings" element={isStaff ? <Navigate to="/sales" replace /> : <SettingsPage />} />
                        <Route path="*" element={<Navigate to={canReport ? '/' : '/sales'} replace />} />
                      </>
                    )}
                  </Routes>
                </Main>
                {/* Mounted for everyone, not just `canReport`: a cashier without
                    the reporting module still has a branch to restock, and the
                    panel is a reading surface on their own records. What it will
                    not do for them is state a money figure it cannot see — that
                    gate lives inside the panel (`canSeeFinancials`), because
                    hiding the panel would also hide the stock list. */}
                {ASSISTANT_ENABLED && <AssistantPanel />}
              </Layout>
            } />
            <Route path="/admin" element={
              <AdminCheck>
                <AdminDashboard />
              </AdminCheck>
            } />
          </Route>
        </Routes>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
