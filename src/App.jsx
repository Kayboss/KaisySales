import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { themeTokens } from './styles/themeTokens';
import { getThemeForColor } from './styles/colorThemes';
import { GlobalStyles } from './styles/GlobalStyles';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { dbService, isSupabaseConfigured, isMockFallbackEnabled } from './services/supabase';
import { detectDevice, detectLocation } from './utils/visitTracking';
import CheckAuth from './middleware/CheckAuth';
import AdminCheck from './middleware/AdminCheck';
import ErrorBoundary from './components/common/ErrorBoundary';
import ConfigError from './components/common/ConfigError';
import IdleTimer from './components/common/IdleTimer';

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
import AdminDashboard from './features/admin/AdminDashboard';

// Service business features
import Customers from './features/services/Customers';
import CustomerDetail from './features/services/CustomerDetail';
import IncomeTracking from './features/services/IncomeTracking';
import ServiceExpenses from './features/services/ServiceExpenses';
import ServiceInvoices from './features/services/ServiceInvoices';
import ServiceReporting from './features/services/ServiceReporting';

// Icons
import { LayoutDashboard, Package, CreditCard, ShoppingCart, LogOut, FileText, Store, Settings, Receipt, Menu, X, Users, BarChart3, Shield, History } from 'lucide-react';

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
  letter-spacing: 2px;
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
  gap: 0.75rem;
  padding: 0.85rem;
  text-decoration: none;
  color: ${props => props.$active ? '#FFFFFF' : props.theme.colors.text.onPrimary};
  background: ${props => props.$active ? 'rgba(255,255,255,0.15)' : 'transparent'};
  border-radius: ${themeTokens.borderRadius.md};
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
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

const App = () => {
  const { user, logout } = useAuthStore();
  const { businessName, avatarColor, businessType, role } = useSettingsStore();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isServices = businessType === 'services';
  const theme = avatarColor ? getThemeForColor(avatarColor) : themeTokens;

  const toggleMobileMenu = () => setIsMobileOpen(!isMobileOpen);
  const closeMobileMenu = () => setIsMobileOpen(false);

  useEffect(() => {
    if (user) {
      const page = location.pathname;
      const deviceType = detectDevice();
      const loc = detectLocation();
      dbService.trackPageVisit(user.id, page, deviceType, loc);
    }
  }, [user, location.pathname]);

  const serviceNavLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/service-expenses', icon: CreditCard, label: 'Expenses' },
    { to: '/service-invoices', icon: Receipt, label: 'Invoices' },
    { to: '/service-reporting', icon: BarChart3, label: 'Reports' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const retailNavLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/sales', icon: ShoppingCart, label: 'Daily Sales' },
    { to: '/sales-history', icon: History, label: 'Sales History' },
    { to: '/retail-stores', icon: Store, label: 'Retail Stores' },
    { to: '/expenses', icon: CreditCard, label: 'Expenses' },
    { to: '/invoices', icon: Receipt, label: 'Invoices' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/reporting', icon: FileText, label: 'Reporting' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const navLinks = isServices ? serviceNavLinks : retailNavLinks;

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
        <Routes>
          <Route path="/login" element={!user ? <WelcomePage /> : <Navigate to="/dashboard" />} />
          
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
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
                  <div style={{ marginTop: 'auto' }}>
                    <button 
                      onClick={logout}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.85rem', 
                        background: 'none', 
                        border: 'none', 
                        color: 'rgba(255,255,255,0.85)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.95rem',
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
                  <Routes>
                    {isServices ? (
                      <>
                        <Route index element={<IncomeTracking />} />
                        <Route path="income" element={<IncomeTracking />} />
                        <Route path="customers/:id" element={<CustomerDetail />} />
                        <Route path="customers" element={<Customers />} />
                        <Route path="service-expenses" element={<ServiceExpenses />} />
                        <Route path="service-invoices" element={<ServiceInvoices />} />
                        <Route path="service-reporting" element={<ServiceReporting />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="*" element={<IncomeTracking />} />
                      </>
                    ) : (
                      <>
                        <Route index element={<BusinessOverview />} />
                        <Route path="inventory" element={<InventoryManagement />} />
                        <Route path="sales" element={<DailySales />} />
          <Route path="sales-history" element={<SalesHistory />} />
                        <Route path="invoices" element={<Invoices />} />
                        <Route path="expenses" element={<ExpenseTracking />} />
                        <Route path="reporting" element={<AutomatedReporting />} />
                        <Route path="retail-stores" element={<RetailStores />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="*" element={<BusinessOverview />} />
                      </>
                    )}
                  </Routes>
                </Main>
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
