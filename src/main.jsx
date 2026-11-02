import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeContextProvider } from './context/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { logClientError } from './services/supabase';
import { rememberTouch } from './utils/growth';

// Capture this session's first touch before React mounts anything: the URL and
// referrer that brought someone here are gone the moment a route changes, and
// the signup flow navigates several times before there is a user to attach it
// to. Remembering is a no-op when a touch is already stored.
rememberTouch(window.sessionStorage, {
  href: window.location.href,
  referrer: document.referrer,
  ownHost: window.location.host,
});

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
