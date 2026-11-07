import { useRef, useState } from 'react';
import { ConvexError } from 'convex/values';
import type { PreferenceProposal } from '../../convex/lib/jev';
import { CATEGORY_LABELS } from '../prefs';
import type { Prefs } from '../types';
import { usePreferenceAssistant } from '../data/jevHooks';
import { openSignIn } from './auth/AccountMenu';
import { Button, Card, Field, Textarea } from './ui';

type Props = { prefs: Prefs; setPrefs: (prefs: Prefs) => void };
type FormProps = Props & {
  run: (args: { text: string }) => Promise<PreferenceProposal>;
  isAuthenticated: boolean;
  onSignIn: () => void;
};

/** Pure form export supports browser tests without spending provider calls. */
export function PreferenceAssistantForm({ prefs, setPrefs, run, isAuthenticated, onSignIn }: FormProps) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<PreferenceProposal | null>(null);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const requestVersion = useRef(0);

  async function suggest() {
    const version = ++requestVersion.current;
    setPending(true); setError(''); setProposal(null); setApplied(false);
    try {
      const result = await run({ text: text.trim() });
      if (requestVersion.current === version) setProposal(result);
    } catch (e) {
      if (requestVersion.current === version) setError(e instanceof ConvexError && typeof e.data === 'string' ? e.data : 'Could not suggest priorities. Try again or use the sliders.');
    } finally {
      if (requestVersion.current === version) setPending(false);
    }
  }
  const changes = proposal ? Object.entries(proposal.categories) : [];
  const budget = proposal?.budget;
  const hasChanges = changes.length > 0 || !!budget?.mode;

  return <Card className="mt-stack" aria-label="Describe your priorities">
    <h2 className="font-display text-title text-text">Describe your priorities</h2>
    <p className="mt-2 text-small text-text-muted">Tell us what matters. Review suggested settings before applying them.</p>
    <div className="mt-4">
      <Field label="What are you looking for?" hint="Your description is sent to TypeSafe to suggest settings. Leave out names, contact details and other private information.">
        <Textarea maxLength={1200} rows={3} value={text} placeholder="I want to rent under $2,000 a month, close to trails. Nightlife matters less."
          onChange={e => { requestVersion.current++; setText(e.target.value); setProposal(null); setError(''); setPending(false); setApplied(false); }} />
      </Field>
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
      {isAuthenticated
        ? <Button type="button" disabled={pending || text.trim().length < 5} onClick={suggest}>{pending ? 'Suggesting…' : 'Suggest settings'}</Button>
        : <Button type="button" onClick={onSignIn}>Sign in to suggest settings</Button>}
    </div>
    {error && <p role="alert" className="mt-3 text-small text-danger">{error}</p>}
    {proposal && <section className="mt-4 rounded-control border border-border p-4" aria-label="Suggested settings" aria-live="polite">
      <h3 className="font-semibold">Suggested settings</h3>
      {hasChanges ? <>
        <ul className="mt-2 space-y-1 text-small">
          {changes.map(([key, value]) => <li key={key}>{CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}: {value} / 5</li>)}
          {budget?.mode && <li>{budget.mode === 'rent' ? 'Rent' : 'Buy'}{budget.maxRent !== undefined ? `, up to $${budget.maxRent.toLocaleString('en-US')} per month` : budget.maxValue !== undefined ? `, up to $${budget.maxValue.toLocaleString('en-US')}` : ''}</li>}
        </ul>
        <p className="mt-2 text-caption text-text-muted">Other priorities stay as you set them. You can adjust every slider afterward.</p>
      </> : <p className="mt-2 text-small">No clear setting changes found. Add more detail or adjust the sliders yourself.</p>}
      {!!proposal.uncertain.length && <p className="mt-2 text-small">Please set these yourself: {proposal.uncertain.join(', ')}.</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {hasChanges && <Button type="button" onClick={() => {
          const oldMode = (prefs.budget as { mode?: string }).mode ?? (prefs.budget.maxRent !== undefined ? 'rent' : 'buy');
          const nextBudget = budget?.mode && budget.mode !== oldMode ? { ...budget } : { ...prefs.budget, ...budget };
          setPrefs({ ...prefs, categories: { ...prefs.categories, ...proposal.categories }, budget: nextBudget });
          setProposal(null); setApplied(true);
        }}>Apply suggested settings</Button>}
        <Button type="button" variant="ghost" onClick={() => setProposal(null)}>Dismiss suggestions</Button>
      </div>
    </section>}
    {applied && <p role="status" className="mt-3 text-small">Settings applied. Review your priorities below.</p>}
  </Card>;
}

export default function PreferenceAssistant(props: Props) {
  const assistant = usePreferenceAssistant();
  if (!assistant.enabled) return null;
  return <PreferenceAssistantForm {...props} run={assistant.run} isAuthenticated={assistant.isAuthenticated} onSignIn={openSignIn} />;
}
