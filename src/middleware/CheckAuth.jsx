import { useEffect } from 'react';
import { Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import OnboardingWizard from '../features/auth/OnboardingWizard';
import styled from 'styled-components';
import { Ban, Crown } from 'lucide-react';
import { isSubscriptionExpired } from '../utils/subscriptionLimits';
import Skeleton from '../components/ui/Skeleton';
import SkeletonCards from '../components/ui/SkeletonCards';
import SkeletonTable from '../components/ui/SkeletonTable';
import SkeletonChart from '../components/ui/SkeletonChart';
import SkeletonScreen from '../components/ui/SkeletonScreen';

/* The old bootstrap screen was a centred spinner on a cream page, so the whole
   shell appeared at once when the profile resolved. This mirrors the real
   Layout (280px sidebar + padded main) with grey bones, so the sign-in lands on
   a screen the same shape as the one it is about to replace. */
const AppShell = styled.div`
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.background.main};
`;

const ShellSidebar = styled.div`
  width: 280px;
  flex-shrink: 0;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: ${({ theme }) => (theme.mode === 'dark' ? '#232326' : '#E4E4E7')};

  @media (max-width: 768px) {
    display: none;
  }
`;

const ShellMain = styled.div`
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

/**
 * CheckAuth Middleware Component
 * Protects private routes, loads user profiles, and gates onboarding.
 */
const SuspendedContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #FCF9F3;
  color: #BA1A1A;
  gap: 1.5rem;
  font-family: 'Manrope', sans-serif;
  text-align: center;
  padding: 2rem;
`;

const CheckAuth = () => {
  const { isAuthenticated, isInitialized, user } = useAuthStore();
  const { isOnboarded, loadSettings, isLoading, clearSettings, status, role, subscriptionPlan, subscriptionStatus, subscriptionExpiresAt } = useSettingsStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Load user business settings and details from Firestore when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      loadSettings(user.uid);
    } else {
      clearSettings();
    }
  }, [isAuthenticated, user?.uid, loadSettings, clearSettings]);

  // Show a skeleton of the app shell while auth initializes, the profile loads,
  // or onboarding status is still undetermined.
  if (!isInitialized || (isAuthenticated && (isLoading || isOnboarded === null))) {
    return (
      <AppShell>
        <ShellSidebar>
          <Skeleton height="1.5rem" width="55%" />
          <div style={{ height: '1.5rem' }} />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height="2.25rem" $radius="8px" />
          ))}
        </ShellSidebar>
        <ShellMain>
          <SkeletonScreen label="Loading KaisySales">
            <Skeleton height="2rem" width="40%" />
            <SkeletonCards count={4} />
            <SkeletonChart />
            <SkeletonTable rows={4} cols={4} />
          </SkeletonScreen>
        </ShellMain>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but save the current location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Gatekeeper: if the authenticated user is not onboarded, lock them inside the Wizard
  if (!isOnboarded) {
    return <OnboardingWizard />;
  }

  // Block suspended users
  if (status === 'suspended') {
    return (
      <SuspendedContainer>
        <Ban size={48} />
        <h2 style={{ color: '#1C1B1F', margin: 0 }}>Account Suspended</h2>
        <p style={{ color: '#55423D', maxWidth: 400 }}>
          Your account has been suspended. Please contact support to reactivate your account.
        </p>
        <p style={{ fontSize: '0.85rem', color: '#55423D' }}>
          <a href="mailto:support@kaisysales.com" style={{ color: '#6F240A' }}>support@kaisysales.com</a>
        </p>
      </SuspendedContainer>
    );
  }

  // Block expired subscriptions (skip admins)
  if (role !== 'admin' && isSubscriptionExpired(subscriptionPlan, subscriptionStatus, subscriptionExpiresAt)) {
    const expiredMsg = subscriptionPlan === 'free' || subscriptionPlan === 'none'
      ? 'Your free trial has ended. Please upgrade to continue using KaisySales.'
      : 'Your subscription has expired. Please renew to continue using KaisySales.';
    return (
      <SuspendedContainer>
        <Crown size={48} />
        <h2 style={{ color: '#1C1B1F', margin: 0 }}>Subscription Required</h2>
        <p style={{ color: '#55423D', maxWidth: 400 }}>{expiredMsg}</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button onClick={() => navigate('/settings?tab=subscription')} style={{ padding: '0.75rem 1.5rem', background: '#6F240A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
            View Plans
          </button>
          <button onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#6F240A', border: '1px solid #6F240A', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
            Sign Out
          </button>
        </div>
      </SuspendedContainer>
    );
  }

  return <Outlet />;
};

export default CheckAuth;
