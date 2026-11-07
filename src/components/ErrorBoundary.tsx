import type { ReactNode } from 'react';
import RetryBoundary from './RetryBoundary';

// Top-level safety net: silently remounts after transient errors; never a full-page failure screen.
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  return <RetryBoundary label="the data" className="mx-auto mt-24 max-w-md">{children}</RetryBoundary>;
}
