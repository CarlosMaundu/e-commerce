// src/monitoring.js — reports crashes in the browser to Sentry when
// REACT_APP_SENTRY_DSN is set, and shows a calm message instead of a blank
// page when something breaks.
import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';

const dsn = process.env.REACT_APP_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

const Fallback = () => (
  <div
    role="alert"
    style={{
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 480,
      margin: '15vh auto',
      padding: 24,
      textAlign: 'center',
    }}
  >
    <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
    <p style={{ color: '#555', marginBottom: 20 }}>
      Please reload the page. If it keeps happening, contact us and we’ll sort
      it out.
    </p>
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={{
        padding: '10px 18px',
        borderRadius: 8,
        border: 0,
        background: '#2563eb',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      Reload
    </button>
  </div>
);

/** Wraps the app: crashes are reported (when Sentry is on) and caught. */
export const AppErrorBoundary = ({ children }) => (
  <Sentry.ErrorBoundary fallback={<Fallback />}>
    {children}
  </Sentry.ErrorBoundary>
);
AppErrorBoundary.propTypes = { children: PropTypes.node };
