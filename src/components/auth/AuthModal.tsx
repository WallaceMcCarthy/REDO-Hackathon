import { useEffect, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';

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

const field =
  'mt-1.5 w-full rounded-xl border border-rock-300 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-dusk/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-alpine-500';
const tab = (on: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500 ${
    on ? 'bg-rock-600 text-white shadow-sm' : 'text-rock-800 hover:bg-rock-100'
  }`;

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-rock-100 bg-sand p-6 text-ink shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-xl leading-none text-dusk hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500"
        >
          ×
        </button>
        <h2 id="auth-title" className="pr-10 font-display text-2xl">
          {signingIn ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-dusk">
          {signingIn ? 'Sign in to see your saved towns.' : 'Save towns and homes, and come back to them later.'}
        </p>

        <div className="mt-4 flex gap-1 rounded-full bg-rock-50 p-1" role="group" aria-label="Sign in or create account">
          <button type="button" aria-pressed={signingIn} onClick={() => switchMode('signIn')} className={tab(signingIn)}>
            Sign in
          </button>
          <button type="button" aria-pressed={!signingIn} onClick={() => switchMode('signUp')} className={tab(!signingIn)}>
            Create account
          </button>
        </div>

        <form onSubmit={submit} noValidate className="mt-4">
          <label className="block text-sm font-semibold">
            Email
            <input
              ref={emailInput}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'auth-error' : undefined}
              className={field}
            />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Password
            <input
              type="password"
              required
              autoComplete={signingIn ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'auth-error' : undefined}
              className={field}
            />
            {!signingIn && <span className="mt-1 block text-xs font-normal text-dusk">At least {MIN_PASSWORD} characters.</span>}
          </label>
          <p id="auth-error" role="alert" className={error ? 'mt-3 rounded-xl bg-rock-50 px-3 py-2 text-sm font-semibold text-rock-800' : 'sr-only'}>
            {error}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full cursor-pointer rounded-full bg-rock-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (signingIn ? 'Signing in...' : 'Creating account...') : signingIn ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
