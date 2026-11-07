import { FOCUS } from './ui';

export type View = 'homes' | 'apartments' | 'areas';
const OPTIONS: { id: View; label: string }[] = [
  { id: 'homes', label: 'Homes' },
  { id: 'apartments', label: 'Apartments' },
  { id: 'areas', label: 'Areas' },
];

export default function Segmented({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div role="group" aria-label="What to browse" className="inline-flex rounded-lg bg-rock-100 p-1">
      {OPTIONS.map(o => (
        <button
          key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${FOCUS} ${
            value === o.id ? 'bg-white text-ink shadow-sm' : 'text-dusk hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
