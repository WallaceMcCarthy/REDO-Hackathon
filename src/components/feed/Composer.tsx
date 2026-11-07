import { useState } from 'react';
import { MAX_BODY, validateBody } from '../../../convex/lib/feed';

export default function Composer({ cityName, onSubmit }: { cityName: string; onSubmit: (body: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = validateBody(text);
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(parsed.body);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-rock-100 bg-rock-50 p-4">
      <label htmlFor="feed-composer" className="sr-only">Post to the {cityName} feed</label>
      <textarea
        id="feed-composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_BODY}
        rows={3}
        placeholder={`Ask a question or share a tip about ${cityName}`}
        className="w-full resize-y rounded-xl border border-rock-300 bg-white p-3 text-base text-ink placeholder:text-dusk focus-visible:outline-2 focus-visible:outline-alpine-500"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-dusk" aria-live="polite">{text.length}/{MAX_BODY}</span>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="cursor-pointer rounded-full bg-alpine-700 px-5 py-2 text-sm font-semibold text-white hover:bg-alpine-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500"
        >
          {busy ? 'Posting' : 'Post'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-rock-600">{error}</p>}
    </form>
  );
}
