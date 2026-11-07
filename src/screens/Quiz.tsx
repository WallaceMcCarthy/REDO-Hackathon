import type { Prefs } from '../types';

export default function Quiz(_props: { prefs: Prefs; setPrefs: (p: Prefs) => void; onDone: () => void }) {
  return <main className="p-8 font-display text-2xl">Quiz</main>;
}
