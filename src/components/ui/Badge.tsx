import type { ReactNode } from 'react';

type BadgeProps = { className?: string } & (
  | { tone: 'sample' | 'sponsored'; children?: ReactNode }
  | { tone?: 'neutral'; children: ReactNode }
);

const TONE = {
  sample: 'bg-alpine-100 text-alpine-900',
  sponsored: 'bg-rock-100 text-rock-800',
  neutral: 'border border-border bg-surface-raised text-text',
};
const LABEL = { sample: 'Sample', sponsored: 'Sponsored', neutral: null };

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-semibold ${TONE[tone]} ${className}`}>{children ?? LABEL[tone]}</span>;
}
