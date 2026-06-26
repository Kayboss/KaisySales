import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeContextProvider } from './context/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { logClientError } from './services/supabase';

// Rate-limit client error logging (max 1 per 5 seconds)
let lastErrorLog = 0;
const rateLimitedLog = (error, source) => {
  const now = Date.now();
  if (now - lastErrorLog < 5000) return;
  lastErrorLog = now;
  logClientError(error, source);
};

// Global error handler — logs uncaught errors to the database
window.onerror = (message, source, lineno, colno, error) => {
  rateLimitedLog(error || message, source);
};
window.onunhandledrejection = (event) => {
  rateLimitedLog(event.reason || 'Unhandled Promise rejection', window.location.pathname);
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
