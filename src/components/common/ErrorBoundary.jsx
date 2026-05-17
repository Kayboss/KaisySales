import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  text-align: center;
  padding: 2rem;
`;

const ErrorTitle = styled.h1`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const RefreshButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.text.contrast};
  padding: 0.75rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: 600;
  margin-top: 2rem;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
    transform: translateY(-2px);
  }
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You could log the error to a service like Sentry here
    console.error('Anti-Gravity Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorTitle>System Anomaly Detected</ErrorTitle>
          <p>The Anti-Gravity engine encountered an unexpected instability.</p>
          <RefreshButton onClick={() => window.location.reload()}>
            Reboot Application
          </RefreshButton>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
