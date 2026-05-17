import React, { useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import OnboardingWizard from '../features/auth/OnboardingWizard';
import styled from 'styled-components';
import { Leaf } from 'lucide-react';

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
const CheckAuth = () => {
  const { isAuthenticated, isInitialized, user } = useAuthStore();
  const { isOnboarded, loadSettings, isLoading, clearSettings } = useSettingsStore();
  const location = useLocation();

  // Load user business settings and details from Firestore when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      loadSettings(user.uid);
    } else {
      clearSettings();
    }
  }, [isAuthenticated, user?.uid, loadSettings, clearSettings]);

  // Show a premium loading state if auth state is initializing or settings are fetching
  if (!isInitialized || (isAuthenticated && isLoading)) {
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

  return <Outlet />;
};

export default CheckAuth;
