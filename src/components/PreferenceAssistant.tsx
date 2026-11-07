import { useRef, useState } from 'react';
import { ConvexError } from 'convex/values';
import type { PreferenceProposal } from '../../convex/lib/jev';
import type { Prefs } from '../types';
import { usePreferenceAssistant } from '../data/jevHooks';
import { openSignIn } from './auth/AccountMenu';
import { Button, Card, Field, Textarea } from './ui';

type Props = { prefs: Prefs; setPrefs: (prefs: Prefs) => void; onGo?: (mode: 'buy' | 'rent') => void };
type FormProps = Props & {
  run: (args: { text: string }) => Promise<PreferenceProposal>;
  isAuthenticated: boolean;
  onSignIn: () => void;
};

/** Pure form export supports browser tests without spending provider calls. */
export function PreferenceAssistantForm({ prefs, setPrefs, onGo, run, isAuthenticated, onSignIn }: FormProps) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const latestPrefs = useRef(prefs);
  latestPrefs.current = prefs;

  async function suggest() {
    const version = ++requestVersion.current;
    setPending(true); setError('');
    try {
      const result = await run({ text: text.trim() });
      if (requestVersion.current !== version) return;
      const changed = Object.keys(result.categories).length > 0 || !!result.budget?.mode;
      if (!changed) {
        // Nothing to change: still go straight to the map with the current settings.
        onGo?.((latestPrefs.current.budget as { mode?: 'buy' | 'rent' }).mode ?? (latestPrefs.current.budget.maxRent !== undefined ? 'rent' : 'buy'));
        return;
      }
      // One click: apply the suggestion and go straight to the results map.
      const b = result.budget;
      const cur = latestPrefs.current;
      const oldMode = (cur.budget as { mode?: string }).mode ?? (cur.budget.maxRent !== undefined ? 'rent' : 'buy');
      const nextBudget = b?.mode && b.mode !== oldMode ? { ...b } : { ...cur.budget, ...b };
      const next = { ...cur, categories: { ...cur.categories, ...result.categories }, budget: nextBudget };
      setPrefs(next);
      const mode = (nextBudget as { mode?: 'buy' | 'rent' }).mode ?? (nextBudget.maxRent !== undefined ? 'rent' : 'buy');
      onGo?.(mode);
    } catch (e) {
      if (requestVersion.current === version) setError(e instanceof ConvexError && typeof e.data === 'string' ? e.data : 'Could not suggest priorities. Try again or use the sliders.');
    } finally {
      if (requestVersion.current === version) setPending(false);
    }
  }
  return <Card className="mt-stack" aria-label="Describe your priorities">
    <h2 className="font-display text-title text-text">Describe your priorities</h2>
    <p className="mt-2 text-small text-text-muted">Describe what you want and we'll set your priorities and show matching homes. You can adjust every slider afterward.</p>
    <div className="mt-4">
      <Field label="What are you looking for?" hint="Your description is sent to TypeSafe to suggest settings. Leave out names, contact details and other private information.">
        <Textarea maxLength={1200} rows={3} value={text} placeholder="I want to rent under $2,000 a month, close to trails. Nightlife matters less."
          onChange={e => { requestVersion.current++; setText(e.target.value); setError(''); setPending(false); }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isAuthenticated && !pending && text.trim().length >= 5) { e.preventDefault(); void suggest(); } }} />
      </Field>
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
      {isAuthenticated
        ? <Button type="button" disabled={pending || text.trim().length < 5} onClick={suggest}>{pending ? 'Finding homes…' : 'Find my homes'}</Button>
        : <Button type="button" onClick={onSignIn}>Sign in to use this</Button>}
    </div>
    {error && <p role="alert" className="mt-3 text-small text-danger">{error}</p>}
  </Card>;
}

export default function PreferenceAssistant(props: Props) {
  const assistant = usePreferenceAssistant();
  if (!assistant.enabled) return null;
  return <PreferenceAssistantForm {...props} run={assistant.run} isAuthenticated={assistant.isAuthenticated} onSignIn={openSignIn} />;
}
