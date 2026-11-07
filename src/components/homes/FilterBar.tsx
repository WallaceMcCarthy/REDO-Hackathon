import type { View } from './Segmented';
import { FOCUS, money } from './ui';

export type Sort = 'fit' | 'price_asc' | 'newest';
const HOME_BUDGETS = [300_000, 400_000, 500_000, 650_000, 800_000, 1_000_000, 1_500_000];
const RENT_BUDGETS = [1200, 1500, 1800, 2200, 2800, 3500];

const selectCls = `h-9 cursor-pointer rounded-lg border border-rock-100 bg-white px-2.5 text-sm text-ink hover:border-rock-300 ${FOCUS}`;

type Props = { view: View; budget?: number; onBudget: (n?: number) => void; sort: Sort; onSort: (s: Sort) => void };

export default function FilterBar({ view, budget, onBudget, sort, onSort }: Props) {
  if (view === 'areas') return null;
  const apt = view === 'apartments';
  const base = apt ? RENT_BUDGETS : HOME_BUDGETS;
  const options = budget !== undefined && !base.includes(budget) ? [...base, budget].sort((a, b) => a - b) : base;
  const fmt = (n: number) => (apt ? `$${n.toLocaleString()}/mo` : money(n));
  const label = apt ? 'Max rent' : 'Max price';
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-dusk">
        <span className="hidden font-medium sm:inline">{label}</span>
        <select aria-label={label} value={budget ?? ''} onChange={e => onBudget(e.target.value === '' ? undefined : Number(e.target.value))} className={selectCls}>
          <option value="">{apt ? 'Any rent' : 'Any price'}</option>
          {options.map(n => <option key={n} value={n}>{fmt(n)}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-dusk">
        <span className="hidden font-medium sm:inline">Sort</span>
        <select aria-label="Sort" value={sort} onChange={e => onSort(e.target.value as Sort)} className={selectCls}>
          <option value="fit">Best fit</option>
          <option value="price_asc">{apt ? 'Lowest rent' : 'Lowest price'}</option>
          <option value="newest">Newest built</option>
        </select>
      </label>
    </>
  );
}
