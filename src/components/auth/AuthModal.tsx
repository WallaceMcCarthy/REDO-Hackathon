import { useEffect, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Field, Input } from '../ui';

type Mode = 'signIn' | 'signUp';

const MIN_PASSWORD = 8;

const TAB = 'min-h-11 flex-1 cursor-pointer rounded-pill px-3 text-small font-semibold transition-colors';

/** Convex Auth throws "Invalid credentials" (bad sign in), "Invalid password" (under 8 chars) and "Account X already exists" (sign up). Production may redact the text, so fall back by mode. */
function plainError(err: unknown, mode: Mode): string {
  const text = err instanceof Error ? err.message : '';
  if (/valid email/i.test(text)) return 'Enter a valid email address.';
  if (/invalid password/i.test(text)) return `Use at least ${MIN_PASSWORD} characters for your password.`;
  if (/already exists/i.test(text)) return 'That email already has an account. Try signing in instead.';
  if (/invalid credentials|invalidsecret|invalidaccountid/i.test(text)) return 'Wrong email or password. Check both and try again.';
  if (/server error/i.test(text)) {
    return mode === 'signIn'
      ? 'Wrong email or password. Check both and try again.'
      : 'That email already has an account. Try signing in instead.';
  }
  return 'Something went wrong. Check your connection and try again.';
}

let lastPressed: Element | null = null;
if (typeof document !== 'undefined') document.addEventListener('click', e => { lastPressed = (e.target as Element).closest('button, a'); }, true);

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Safari does not focus a button on click, so activeElement is body; fall back to the pressed control.
    const opener = (document.activeElement === document.body ? lastPressed : document.activeElement) as HTMLElement | null;
    emailInput.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') return onCloseRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input');
      // Safari's Tab skips buttons by default, so step focus ourselves instead of trusting the browser.
      e.preventDefault();
      const at = Array.from(items).indexOf(document.activeElement as HTMLElement);
      items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'signUp' && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setBusy(true);
    try {
      await signIn('password', { email, password, flow: mode });
      onClose();
    } catch (err) {
      setError(plainError(err, mode));
    } finally {
      setBusy(false);
    }
  }

  const signingIn = mode === 'signIn';
  const describedBy = error ? 'auth-error' : undefined;
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-alpine-900/60 p-gutter backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto w-full max-w-md rounded-card bg-surface-raised p-6 text-text shadow-overlay sm:p-8"
      >
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 w-11 px-0">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </Button>
        <h2 id="auth-title" className="pr-10 font-display text-heading">
          {signingIn ? 'Sign in' : 'Create your account'}
        </h2>
        <p className="mt-2 text-body text-text-muted">
          {signingIn ? 'Save homes, comment and message. New here? Choose Create account.' : 'Save homes, comment and message, and come back to them later.'}
        </p>

        <div className="mt-6 flex gap-1 rounded-pill bg-surface-sunken p-1" role="group" aria-label="Sign in or create account">
          {([['signIn', 'Sign in'], ['signUp', 'Create account']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => switchMode(value)}
              className={`${TAB} ${mode === value ? 'bg-surface-raised text-text shadow-raised' : 'text-text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Email" invalid={!!error}>
            <Input ref={emailInput} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} />
          </Field>
          <Field label="Password" invalid={!!error} hint={signingIn ? undefined : `At least ${MIN_PASSWORD} characters.`}>
            <Input type="password" required autoComplete={signingIn ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={describedBy} />
          </Field>
          <p id="auth-error" role="alert" className={error ? 'flex gap-2 rounded-control border border-rock-300 bg-surface-sunken px-3 py-2.5 text-small font-semibold text-danger' : 'sr-only'}>
            {error && (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-px size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.01" /></svg>
            )}
            {error}
          </p>
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {busy ? (signingIn ? 'Signing in...' : 'Creating account...') : signingIn ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
