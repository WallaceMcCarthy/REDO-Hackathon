import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  /** What to do next, not how it feels. */
  description?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div role="status" className={`rounded-card border border-dashed border-rock-300 p-6 text-center ${className}`}>
      <h2 className="font-display text-title text-text">{title}</h2>
      {description && <p className="mx-auto mt-1 max-w-prose text-small text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
