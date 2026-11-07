import type { ButtonHTMLAttributes } from 'react';

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { pressed: boolean };

export function Chip({ pressed, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={pressed}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        pressed ? 'border-alpine-500 bg-alpine-50 text-alpine-700' : 'border-border bg-surface-raised text-text hover:border-rock-300'
      } ${className}`}
    >
      {pressed && (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
      {children}
    </button>
  );
}
