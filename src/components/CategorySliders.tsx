import { useMetrics } from '../data/hooks';
import { CATEGORY_LABELS } from '../prefs';
import { CATEGORIES, type CategoryWeights } from '../types';

export default function CategorySliders({ value, onChange }: { value: CategoryWeights; onChange: (next: CategoryWeights) => void }) {
  const metrics = useMetrics();
  // A category with no metrics yet would be a slider that changes nothing.
  const shown = CATEGORIES.filter(category => !metrics || metrics.some(m => m.category === category));
  return (
    <div className="space-y-3">
      {shown.map(category => (
        <label key={category} className="block">
          <span className="flex justify-between text-sm text-ink">
            <span>{CATEGORY_LABELS[category]}</span>
            <span className="tabular-nums text-dusk">{value[category]}</span>
          </span>
          <input
            type="range" min={0} max={5} step={1} value={value[category]}
            onChange={e => onChange({ ...value, [category]: Number(e.target.value) })}
            className="w-full accent-rock-500"
          />
        </label>
      ))}
    </div>
  );
}
