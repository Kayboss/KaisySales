import { Component } from 'react';
import styled from 'styled-components';
import { themeTokens } from '../../styles/themeTokens';
import { logClientError } from '../../services/supabase';

// This screen renders from main.jsx, outside any styled-components ThemeProvider,
// and it may be showing precisely because rendering failed. So it reads the
// token object directly instead of a theme from context, which would leave every
// colour undefined here.
const ErrorContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${themeTokens.colors.background.main};
  color: ${themeTokens.colors.text.main};
  font-family: ${themeTokens.fonts.main};
  text-align: center;
  padding: 2rem;
`;

const ErrorTitle = styled.h1`
  font-family: ${themeTokens.fonts.display};
  font-size: ${themeTokens.fontSizes['3xl']};
  margin-bottom: 1rem;
  color: ${themeTokens.colors.primary};
`;

const ErrorMessage = styled.p`
  color: ${themeTokens.colors.text.muted};
  max-width: 34rem;
  margin-bottom: 0.5rem;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2rem;
`;

const RefreshButton = styled.button`
  background: ${themeTokens.colors.primary};
  color: ${themeTokens.colors.text.onPrimary};
  padding: 0.75rem 2rem;
  border: none;
  border-radius: ${themeTokens.borderRadius.md};
  font-weight: 600;
  font-family: ${themeTokens.fonts.main};
  cursor: pointer;
  transition: ${themeTokens.transitions.fast};

  &:hover {
    background: ${themeTokens.colors.primaryContainer};
    transform: translateY(-2px);
  }
`;

// This screen sits outside BrowserRouter in main.jsx, so react-router's Link
// and useNavigate are unavailable here. A plain anchor does a full page load,
// which is what you want after a crash anyway.
const DashboardButton = styled.a`
  display: inline-block;
  background: ${themeTokens.colors.background.surface};
  color: ${themeTokens.colors.primary};
  padding: 0.75rem 2rem;
  border: 1px solid ${themeTokens.colors.primary};
  border-radius: ${themeTokens.borderRadius.md};
  font-weight: 600;
  font-family: ${themeTokens.fonts.main};
  text-decoration: none;
  cursor: pointer;
  transition: ${themeTokens.transitions.fast};

  &:hover {
    background: ${themeTokens.colors.background.surfaceVariant};
    transform: translateY(-2px);
  }
`;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);
    logClientError(error, window.location.pathname);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorTitle>Something went wrong</ErrorTitle>
          <ErrorMessage>
            KaisySales ran into a problem loading this page. Your sales, expenses and
            inventory are stored safely and have not been lost.
          </ErrorMessage>
          <ErrorMessage>Reload the page, or head back to your dashboard.</ErrorMessage>
          <ButtonRow>
            <RefreshButton onClick={() => window.location.reload()}>
              Reload page
            </RefreshButton>
            <DashboardButton href="/dashboard">Return to dashboard</DashboardButton>
          </ButtonRow>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
