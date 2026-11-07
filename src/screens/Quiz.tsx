import { useState, type ReactNode } from 'react';
import CategorySliders from '../components/CategorySliders';
import { Button, Card, Field, Input, Segmented, Skeleton } from '../components/ui';
import { useMetrics } from '../data/hooks';
import { applyPersonas, PERSONAS } from '../prefs';
import type { Prefs } from '../types';

const ICONS: Record<string, ReactNode> = {
  skier: <path d="M3 19l6-11 3 5 3-6 6 12z" />,
  family: <path d="M3 11l9-7 9 7v9H3zM10 20v-6h4v6" />,
  remote: <path d="M5 6h14v9H5zM2 19h20" />,
  foodie: <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 2-3 5-3 8h3" />,
};

type Mode = 'buy' | 'rent';
const MODES = [
  { value: 'buy', label: 'Buy' },
  { value: 'rent', label: 'Rent' },
] as const;

export default function Quiz({ prefs, setPrefs, onDone }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onDone: () => void }) {
  // CategorySliders shows every category while metrics load, which would flash a slider that changes nothing.
  const metricsLoaded = useMetrics() !== undefined;
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>(prefs.budget.maxRent !== undefined ? 'rent' : 'buy');
  const amount = (mode === 'buy' ? prefs.budget.maxValue : prefs.budget.maxRent) ?? '';

  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter(p => p !== id) : [...picked, id];
    setPicked(next);
    setPrefs({ ...prefs, categories: applyPersonas(next) });
  };

  // The two caps never coexist: switching mode drops the other one, since the scales differ.
  const setBudget = (m: Mode, raw: string) => {
    const n = Number(raw.replace(/\D/g, '')) || undefined;
    setPrefs({ ...prefs, budget: n === undefined ? {} : m === 'buy' ? { maxValue: n } : { maxRent: n } });
  };

  return (
    <main className="mx-auto max-w-5xl px-gutter pb-section">
      <section className="grid gap-stack pt-section lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-section">
        <div>
          <h1 className="font-display text-display break-words text-text">Find a home in Utah that fits how you live</h1>
          <p className="mt-4 max-w-xl text-body text-text-muted">
            Set a budget and tell us what matters. We rank 42 Utah towns on it and explain every score with its source.
          </p>
          <Button href="#/results" variant="secondary" className="mt-stack">Browse areas instead</Button>
        </div>

        <Card raised aria-labelledby="budget">
          <h2 id="budget" className="font-display text-title text-text">Your budget</h2>
          <Segmented
            label="Buying or renting"
            options={MODES}
            value={mode}
            onChange={m => { setMode(m); setBudget(m, ''); }}
            className="mt-3"
          />
          <Field
            className="mt-4"
            label={mode === 'buy' ? 'Max price' : 'Max rent per month'}
            hint="Leave blank for no limit."
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder={mode === 'buy' ? 'e.g. 500000' : 'e.g. 2000'}
              value={amount === '' ? '' : `$${amount.toLocaleString('en-US')}`}
              onChange={e => setBudget(mode, e.target.value)}
            />
          </Field>
        </Card>
      </section>

      <section aria-labelledby="who" className="mt-section">
        <h2 id="who" className="font-display text-heading text-text">Who is moving?</h2>
        <p className="mt-1 text-body text-text-muted">Pick one or more. They stack, and you can fine tune below.</p>
        <div className="mt-stack grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map(p => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-card border-2 p-4 text-left transition-colors min-[460px]:flex-col min-[460px]:items-start ${
                  on ? 'border-primary bg-surface-sunken' : 'border-border bg-surface-raised hover:border-border-strong'
                }`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-pill ${on ? 'bg-primary text-on-primary' : 'bg-alpine-100 text-alpine-700'}`}>
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[p.id]}
                  </svg>
                </span>
                <span>
                  <span className="block font-display text-title text-text">{p.label}</span>
                  <span className="mt-0.5 block text-small text-text-muted">{p.tagline}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="tune" className="mt-section grid gap-stack md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="tune" className="font-display text-heading text-text">Fine tune what counts</h2>
          <p className="mt-1 max-w-sm text-body text-text-muted">
            0 ignores a category, 5 makes it matter most. Choosing a persona sets these for you, and you can move any slider afterwards.
          </p>
        </div>
        <Card>
          {metricsLoaded ? (
            <CategorySliders value={prefs.categories} onChange={categories => setPrefs({ ...prefs, categories })} />
          ) : (
            <div aria-busy="true" className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          )}
        </Card>
      </section>

      <div className="mt-section flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={onDone}>Show my matches</Button>
        <Button href="#/results" variant="ghost" size="lg">Browse areas</Button>
      </div>
    </main>
  );
}
