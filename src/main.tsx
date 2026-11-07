import { StrictMode, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient, useMutation } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
const ERROR_SESSION_STORAGE = 'redo.client-error-session';

function sessionKey() {
  const existing = localStorage.getItem(ERROR_SESSION_STORAGE);
  if (existing) return existing;
  const key = crypto.randomUUID();
  localStorage.setItem(ERROR_SESSION_STORAGE, key);
  return key;
}

function AppWithErrorReporting() {
  const report = useMutation(api.clientErrors.report);
  const send = useCallback((source: 'boundary' | 'error' | 'rejection', value: unknown) => {
    // Deliberately send an error class only: raw messages and URLs can contain user data.
    const errorName = value instanceof Error ? value.name : 'UnknownError';
    void report({ sessionKey: sessionKey(), source, errorName }).catch(() => {});
  }, [report]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => send('error', event.error);
    const onRejection = (event: PromiseRejectionEvent) => send('rejection', event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [send]);

  return <ErrorBoundary onError={error => send('boundary', error)}><App /></ErrorBoundary>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <AppWithErrorReporting />
    </ConvexAuthProvider>
  </StrictMode>,
);
