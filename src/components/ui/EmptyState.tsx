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
    <div className={`rounded-card border border-dashed border-border-strong px-5 py-section text-center ${className}`}>
      <h3 className="font-display text-title text-text">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-prose text-small text-text-muted">{description}</p>}
      {action && <div className="mt-stack">{action}</div>}
    </div>
  );
}
