import { cloneElement, forwardRef, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const control =
  'w-full rounded-control border border-border-strong bg-surface-raised px-3.5 text-body text-text placeholder:text-text-muted disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} {...rest} className={`${control} min-h-11 ${className}`} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} {...rest} className={`${control} block resize-y py-2.5 ${className}`} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', children, ...rest }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} {...rest} className={`${control} min-h-11 cursor-pointer appearance-none pr-10 ${className}`}>{children}</select>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
});

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** One control. It receives id, aria-describedby and aria-invalid. */
  children: ReactElement;
  className?: string;
};

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-small font-semibold text-text">{label}</label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && <p id={hintId} className="mt-1.5 text-caption text-text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1.5 text-small font-semibold text-danger">{error}</p>}
    </div>
  );
}
