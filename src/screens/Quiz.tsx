import { useState, type ReactNode } from 'react';
import CategorySliders from '../components/CategorySliders';
import { applyPersonas, PERSONAS } from '../prefs';
import type { Prefs } from '../types';

const ICONS: Record<string, ReactNode> = {
  skier: <path d="M3 19l6-11 3 5 3-6 6 12z" />,
  family: <path d="M3 11l9-7 9 7v9H3zM10 20v-6h4v6" />,
  remote: <path d="M5 6h14v9H5zM2 19h20" />,
  foodie: <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2 2-3 5-3 8h3" />,
};

function Skyline() {
  return (
    <>
    <div className="absolute bottom-24 right-[12%] size-24 rounded-full bg-rock-300 sm:bottom-40 sm:size-36" />
    <svg viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-44 w-full sm:h-64">
      <path d="M0 170l90-70 60 40 80-80 90 90 70-50 110 70 80-60 100 70 120-50v170H0z" className="fill-alpine-700" />
      <path d="M0 190l60-30 40-45h70l30 45h60l20-35h90l30 35h60l40-55h80l20 55h60l30-40h110v165H0z" className="fill-rock-600" />
      <path d="M0 220h110l15-40h90l15 40h130l25-50h70l20 50h140l15-30h90l30 30h60v40H0z" className="fill-rock-800" />
      <path d="M0 250c120-24 220-12 330-6s240 10 470-8v24H0z" className="fill-sand" />
    </svg>
    </>
  );
}

export default function Quiz({ prefs, setPrefs, onDone }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter(p => p !== id) : [...picked, id];
    setPicked(next);
    setPrefs({ ...prefs, categories: applyPersonas(next) });
  };

  return (
    <main className="min-h-full">
      <header className="relative overflow-hidden bg-alpine-900 text-white">
        <Skyline />
        <div className="relative mx-auto max-w-5xl px-5 pb-48 pt-14 sm:pb-64 sm:pt-20">
          <p className="font-display text-lg text-rock-300">Utah Fit</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.1] sm:text-6xl break-words">
            Find the Utah town that fits the way you live.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-alpine-100 sm:text-lg">
            Tell us what matters to you. We rank 42 Utah towns on it, show them on a map, and explain every score with its source.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-16">
        <section aria-labelledby="who" className="pt-8">
          <h2 id="who" className="font-display text-2xl text-ink sm:text-3xl">Who is moving?</h2>
          <p className="mt-1 text-dusk">Pick one or more. They stack, and you can fine tune below.</p>
          <div className="mt-5 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map(p => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={`group flex min-h-[48px] cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500 ${
                    on ? 'border-rock-500 bg-rock-50 shadow-md' : 'border-rock-100 bg-white hover:border-rock-300'
                  }`}
                >
                  <span className={`grid size-11 place-items-center rounded-full transition ${on ? 'bg-rock-500 text-white' : 'bg-alpine-100 text-alpine-700'}`}>
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[p.id]}
                    </svg>
                  </span>
                  <span>
                    <span className="block font-display text-xl text-ink">{p.label}</span>
                    <span className="mt-0.5 block text-sm text-dusk">{p.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="tune" className="mt-12 grid gap-8 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="tune" className="font-display text-2xl text-ink sm:text-3xl">Fine tune what counts</h2>
            <p className="mt-1 max-w-sm text-dusk">
              0 ignores a category, 5 makes it matter most. Choosing a persona sets these for you, and you can move any slider afterwards.
            </p>
          </div>
          <div className="rounded-2xl border border-rock-100 bg-white p-5 sm:p-6">
            <CategorySliders value={prefs.categories} onChange={categories => setPrefs({ ...prefs, categories })} />
          </div>
        </section>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onDone}
            className="cursor-pointer rounded-full bg-rock-500 px-8 py-3.5 font-display text-lg text-white shadow-md transition hover:bg-rock-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500 min-h-[48px] inline-flex items-center justify-center"
          >
            Show my towns
          </button>
          <p className="text-sm text-dusk">You can change everything later on the results screen.</p>
        </div>
      </div>
    </main>
  );
}
