import type { ReactNode } from 'react';
import RetryBoundary from './RetryBoundary';

/**
 * Protects subcomponents (like comments or listings) from crashing parent screens
 * when backend functions are pending deployment or seeding. Retries silently first.
 */
export default function SafeSectionBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <RetryBoundary fallback={fallback}>{children}</RetryBoundary>;
}
