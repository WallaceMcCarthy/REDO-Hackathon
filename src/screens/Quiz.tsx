import { useState, type ReactNode } from 'react';
import CategorySliders from '../components/CategorySliders';
import { UtahScene } from '../components/landing/UtahScene';
import { Button, Card, Field, Input, Segmented } from '../components/ui';
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
    <main className="pb-section">
      <section className="relative isolate overflow-hidden">
        <UtahScene />
        <div className="mx-auto max-w-6xl px-gutter pb-10 pt-10 lg:pb-16 lg:pt-16">
          <h1 className="max-w-3xl text-balance break-words font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-alpine-900">Find a home in Utah that fits how you live</h1>
          <p className="mt-4 max-w-xl text-title text-alpine-900">
            Set a budget and tell us what matters. We rank 42 Utah towns on it and explain every score with its source.
          </p>

          <Card raised aria-labelledby="budget" className="mt-8 lg:mt-36">
            <form onSubmit={e => { e.preventDefault(); onDone(); }}>
              <h2 id="budget" className="font-display text-title text-text">Your budget</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-[16rem_1fr_auto] lg:items-end">
                <Segmented
                  label="Buying or renting"
                  options={MODES}
                  value={mode}
                  onChange={m => { setMode(m); setBudget(m, ''); }}
                />
                <Field label={mode === 'buy' ? 'Max price' : 'Max rent per month'}>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    aria-describedby="budget-hint"
                    placeholder={mode === 'buy' ? 'e.g. 500000' : 'e.g. 2000'}
                    value={amount === '' ? '' : `$${amount.toLocaleString('en-US')}`}
                    onChange={e => setBudget(mode, e.target.value)}
                  />
                </Field>
                <Button type="submit" size="lg">Show my matches</Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
                <p id="budget-hint" className="text-caption text-text-muted lg:pl-[17rem]">Leave blank for no limit.</p>
                <Button href="#/results" variant="ghost" size="sm" className="-mr-4">Browse areas instead</Button>
              </div>
            </form>
          </Card>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-gutter">
        <section aria-labelledby="who" className="mt-stack">
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

        <section aria-labelledby="tune" className="mt-section">
          <div>
            <h2 id="tune" className="font-display text-heading text-text">Fine tune what counts</h2>
            <p className="mb-stack mt-1 max-w-2xl text-body text-text-muted">
              Choosing a persona sets these for you, and you can move any slider afterwards.
            </p>
          </div>
          <Card>
            <CategorySliders
              value={prefs.categories}
              onChange={categories => setPrefs({ ...prefs, categories })}
              className="grid gap-x-10 gap-y-5 lg:grid-cols-2"
            />
          </Card>
        </section>

        <div className="mt-stack flex justify-end">
          <Button size="lg" onClick={onDone} className="w-full sm:w-auto">Show matches with these priorities</Button>
        </div>
      </div>
    </main>
  );
}
