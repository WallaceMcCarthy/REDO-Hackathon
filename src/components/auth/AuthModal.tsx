import { useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn('password', { email, password, flow: mode });
      onClose();
    } catch {
      setError(mode === 'signIn' ? 'Wrong email or password.' : 'Could not create that account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900"
      >
        <h2 className="mb-4 text-lg font-semibold">{mode === 'signIn' ? 'Sign in' : 'Create an account'}</h2>
        <label className="mb-2 block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded bg-red-700 py-2 font-medium text-white disabled:opacity-50">
          {busy ? 'Working...' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          className="mt-3 w-full text-sm text-neutral-600 underline"
        >
          {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full text-sm text-neutral-400">
          Cancel
        </button>
      </form>
    </div>
  );
}
