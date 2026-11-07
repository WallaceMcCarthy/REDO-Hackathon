import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Buttons, aligned right on wide screens and below the text on phones. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-heading text-text">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-body text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
