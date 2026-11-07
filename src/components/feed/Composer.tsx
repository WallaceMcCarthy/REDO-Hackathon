import { useState } from 'react';
import { ConvexError } from 'convex/values';
import { MAX_BODY, validateBody } from '../../../convex/lib/feed';
import { Button, Card, Field, Textarea } from '../ui';

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
      setError(err instanceof ConvexError ? String(err.data) : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="div" className="bg-surface-sunken">
      <form onSubmit={submit}>
        <Field label={`Post to the ${cityName} feed`} error={error} className="[&>label]:sr-only">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
            placeholder={`Ask a question or share a tip about ${cityName}`}
          />
        </Field>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-caption tabular-nums text-text-muted" aria-live="polite">{text.length}/{MAX_BODY}</span>
          <Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>{busy ? 'Posting' : 'Post'}</Button>
        </div>
      </form>
    </Card>
  );
}
