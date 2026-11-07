import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
type Style = { variant?: Variant; size?: Size; fullWidth?: boolean };

export type ButtonProps =
  | (Style & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined; loading?: boolean })
  | (Style & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; loading?: undefined });

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-surface-raised text-text hover:bg-surface-sunken',
  ghost: 'text-primary-hover hover:bg-rock-100',
  // Outlined so a destructive action never reads as the page's main call to action.
  danger: 'border-2 border-danger bg-surface-raised text-danger hover:bg-danger hover:text-on-primary',
};
const SIZE: Record<Size, string> = {
  sm: 'min-h-11 px-4 text-small',
  md: 'min-h-12 px-5 text-small',
  lg: 'min-h-14 px-8 text-body',
};

export function Button({ variant = 'primary', size = 'md', fullWidth, className = '', children, ...rest }: ButtonProps) {
  const classes = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill text-center font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  if (rest.href !== undefined) {
    const { loading: _, ...anchor } = rest;
    return <a {...anchor} className={classes}>{children}</a>;
  }
  const { loading, disabled, type = 'button', ...button } = rest;
  return (
    <button {...button} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes}>
      {loading && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />}
      {children}
    </button>
  );
}
