import React, { useEffect } from 'react';
import { Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import OnboardingWizard from '../features/auth/OnboardingWizard';
import styled from 'styled-components';
import { Leaf, Ban, Crown } from 'lucide-react';
import { isSubscriptionExpired } from '../utils/subscriptionLimits';

const LoaderContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #FCF9F3;
  color: #6F240A;
  gap: 1.5rem;
  font-family: 'Manrope', sans-serif;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid rgba(111, 36, 10, 0.1);
  border-top-color: #6F240A;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
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

  // Show a premium loading state while auth initializes, profile loads, or onboarding status is undetermined
  if (!isInitialized || (isAuthenticated && (isLoading || isOnboarded === null))) {
    return (
      <LoaderContainer>
        <Spinner />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, letterSpacing: '1px' }}>
          <Leaf size={20} /> KaisySales
        </div>
        <p style={{ fontSize: '0.9rem', color: '#55423D', fontWeight: 600 }}>
          Weaving your digital workshop...
        </p>
      </LoaderContainer>
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

  // Redirect admins to admin dashboard on initial login
  if (role === 'admin' && location.pathname === '/') {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
};

export default CheckAuth;
