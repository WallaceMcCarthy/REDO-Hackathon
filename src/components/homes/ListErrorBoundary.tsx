import type { ReactNode } from 'react';
import RetryBoundary from '../RetryBoundary';

export default function ListErrorBoundary({ children }: { children: ReactNode }) {
  return <RetryBoundary label="places">{children}</RetryBoundary>;
}
