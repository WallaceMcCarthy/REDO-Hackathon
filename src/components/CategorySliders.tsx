import { useMetrics } from '../data/hooks';
import { CATEGORY_LABELS } from '../prefs';
import { CATEGORIES, type CategoryWeights } from '../types';

export default function CategorySliders({ value, onChange }: { value: CategoryWeights; onChange: (next: CategoryWeights) => void }) {
  const metrics = useMetrics();
  // A category with no metrics yet would be a slider that changes nothing.
  const shown = CATEGORIES.filter(category => !metrics || metrics.some(m => m.category === category));
  return (
    <div className="space-y-4">
      {shown.map(category => (
        <label key={category} className="block cursor-pointer">
          <span className="flex justify-between text-sm text-ink pb-1">
            <span className="font-medium">{CATEGORY_LABELS[category]}</span>
            <span className="tabular-nums font-semibold text-dusk">{value[category]}</span>
          </span>
          <div className="flex min-h-[44px] items-center">
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={value[category]}
              onChange={e => onChange({ ...value, [category]: Number(e.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-rock-200 accent-rock-500 focus-visible:outline-2 focus-visible:outline-alpine-500"
            />
          </div>
        </label>
      ))}
    </div>
  );
}
