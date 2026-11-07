import { useEffect, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button, Field, Input } from '../ui';

type Mode = 'signIn' | 'signUp';

const MIN_PASSWORD = 8;

/** Convex Auth throws "Invalid credentials" (bad sign in), "Invalid password" (under 8 chars) and "Account X already exists" (sign up). Production may redact the text, so fall back by mode. */
function plainError(err: unknown, mode: Mode): string {
  const text = err instanceof Error ? err.message : '';
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
    const opener = document.activeElement as HTMLElement | null;
    emailInput.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') return onCloseRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input');
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-text/60 p-gutter" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-card border border-border bg-surface p-6 text-text shadow-overlay"
      >
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 w-11 px-0 text-title leading-none">
          ×
        </Button>
        <h2 id="auth-title" className="pr-10 font-display text-title">
          {signingIn ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mt-1 text-small text-text-muted">
          {signingIn ? 'Sign in to see your saved towns.' : 'Save towns and homes, and come back to them later.'}
        </p>

        <div className="mt-4 flex gap-1 rounded-pill bg-surface-sunken p-1" role="group" aria-label="Sign in or create account">
          <Button size="sm" variant={signingIn ? 'secondary' : 'ghost'} aria-pressed={signingIn} onClick={() => switchMode('signIn')} className="flex-1">
            Sign in
          </Button>
          <Button size="sm" variant={signingIn ? 'ghost' : 'secondary'} aria-pressed={!signingIn} onClick={() => switchMode('signUp')} className="flex-1">
            Create account
          </Button>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 space-y-3">
          <Field label="Email">
            <Input ref={emailInput} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} />
          </Field>
          <Field label="Password" hint={signingIn ? undefined : `At least ${MIN_PASSWORD} characters.`}>
            <Input type="password" required autoComplete={signingIn ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={describedBy} aria-invalid={error ? true : undefined} />
          </Field>
          <p id="auth-error" role="alert" className={error ? 'rounded-control bg-surface-sunken px-3 py-2 text-small font-semibold text-danger' : 'sr-only'}>
            {error}
          </p>
          <Button type="submit" fullWidth loading={busy}>
            {busy ? (signingIn ? 'Signing in...' : 'Creating account...') : signingIn ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
