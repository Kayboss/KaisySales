import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { themeTokens } from './styles/themeTokens';
import { getThemeForColor } from './styles/colorThemes';
import { GlobalStyles } from './styles/GlobalStyles';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import CheckAuth from './middleware/CheckAuth';
import AdminCheck from './middleware/AdminCheck';
import ErrorBoundary from './components/common/ErrorBoundary';
import IdleTimer from './components/common/IdleTimer';

// Features
import WelcomePage from './features/auth/WelcomePage';
import BusinessOverview from './features/dashboard/BusinessOverview';
import InventoryManagement from './features/inventory/InventoryManagement';
import ExpenseTracking from './features/finance/ExpenseTracking';
import Invoices from './features/finance/Invoices';
import DailySales from './features/finance/DailySales';
import AutomatedReporting from './features/reporting/AutomatedReporting';
import RetailStores from './features/partners/RetailStores';
import SettingsPage from './features/settings/SettingsPage';
import AdminDashboard from './features/admin/AdminDashboard';

// Icons
import { LayoutDashboard, Package, CreditCard, ShoppingCart, LogOut, Leaf, FileText, Store, Settings, Receipt, Menu, X } from 'lucide-react';

const Layout = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background.main};
  position: relative;
`;

const coffeeBg = '#4A2C1B';
const milkText = '#F5E6D3';

const Sidebar = styled.nav`
  width: 280px;
  background: ${coffeeBg};
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
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 3rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 768px) {
    padding: 1.5rem;
    padding-top: 5rem;
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
    background: ${coffeeBg};
    padding: 0 1.5rem;
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
  color: ${milkText};
  margin-bottom: 3rem;
  letter-spacing: 2px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${milkText};
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
  color: ${props => props.$active ? '#FFFFFF' : milkText};
  background: ${props => props.$active ? 'rgba(255,255,255,0.12)' : 'transparent'};
  border-radius: ${themeTokens.borderRadius.md};
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
  transition: ${themeTokens.transitions.fast};

  &:hover {
    background: rgba(255,255,255,0.08);
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
  const { businessName, avatarColor } = useSettingsStore();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const theme = avatarColor ? getThemeForColor(avatarColor) : themeTokens;

  const toggleMobileMenu = () => setIsMobileOpen(!isMobileOpen);
  const closeMobileMenu = () => setIsMobileOpen(false);

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
                    <Leaf size={24} />
                    <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{businessName || 'KaisySales'}</span>
                  </Logo>
                  <button onClick={toggleMobileMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F5E6D3' }}>
                    <Menu size={24} />
                  </button>
                </MobileHeader>

                <Overlay $isOpen={isMobileOpen} onClick={closeMobileMenu} />

                <Sidebar $isOpen={isMobileOpen}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <Logo style={{ marginBottom: 0 }}>
                      <Leaf size={24} />
                      <span style={{ fontWeight: 900, textTransform: 'uppercase' }}>{businessName || 'KaisySales'}</span>
                    </Logo>
                    <CloseButton onClick={closeMobileMenu}>
                      <X size={24} />
                    </CloseButton>
                  </div>
                  
                  <NavLink to="/" $active={location.pathname === '/'} onClick={closeMobileMenu}>
                    <LayoutDashboard size={20} />
                    Dashboard
                  </NavLink>
                  <NavLink to="/sales" $active={location.pathname === '/sales'} onClick={closeMobileMenu}>
                    <ShoppingCart size={20} />
                    Daily Sales
                  </NavLink>
                  <NavLink to="/retail-stores" $active={location.pathname === '/retail-stores'} onClick={closeMobileMenu}>
                    <Store size={20} />
                    Retail Stores
                  </NavLink>
                  <NavLink to="/expenses" $active={location.pathname === '/expenses'} onClick={closeMobileMenu}>
                    <CreditCard size={20} />
                    Expenses
                  </NavLink>
                  <NavLink to="/invoices" $active={location.pathname === '/invoices'} onClick={closeMobileMenu}>
                    <Receipt size={20} />
                    Invoices
                  </NavLink>
                  <NavLink to="/inventory" $active={location.pathname === '/inventory'} onClick={closeMobileMenu}>
                    <Package size={20} />
                    Inventory
                  </NavLink>
                  <NavLink to="/reporting" $active={location.pathname === '/reporting'} onClick={closeMobileMenu}>
                    <FileText size={20} />
                    Reporting
                  </NavLink>
                  <NavLink to="/settings" $active={location.pathname === '/settings'} onClick={closeMobileMenu}>
                    <Settings size={20} />
                    Settings
                  </NavLink>
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
                        color: '#F5E6D3',
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
                    <Route index element={<BusinessOverview />} />
                    <Route path="inventory" element={<InventoryManagement />} />
                    <Route path="sales" element={<DailySales />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="expenses" element={<ExpenseTracking />} />
                    <Route path="reporting" element={<AutomatedReporting />} />
                    <Route path="retail-stores" element={<RetailStores />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<BusinessOverview />} />
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
