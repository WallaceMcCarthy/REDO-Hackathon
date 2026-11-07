import type { Prefs } from '../types';

export default function Results(_props: { prefs: Prefs; setPrefs: (p: Prefs) => void; onOpenTown: (id: string) => void; onRestart: () => void }) {
  return <main className="p-8 font-display text-2xl">Results</main>;
}
