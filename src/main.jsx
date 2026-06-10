import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeContextProvider } from './context/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { logClientError } from './services/supabase';

// Global error handler — logs uncaught errors to the database
window.onerror = (message, source, lineno, colno, error) => {
  logClientError(error || message, source);
};
window.onunhandledrejection = (event) => {
  logClientError(event.reason || 'Unhandled Promise rejection', window.location.pathname);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeContextProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeContextProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
