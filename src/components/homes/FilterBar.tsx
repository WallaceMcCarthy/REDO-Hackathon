import type { View } from './Segmented';
import { FOCUS } from './ui';
import PriceSlider from '../PriceSlider';

export type Sort = 'fit' | 'price_asc' | 'newest';

const selectCls = `h-9 cursor-pointer rounded-lg border border-rock-100 bg-white px-2.5 text-sm text-ink hover:border-rock-300 ${FOCUS}`;

type Props = { view: View; budget?: number; onBudget: (n?: number) => void; sort: Sort; onSort: (s: Sort) => void };

export default function FilterBar({ view, budget, onBudget, sort, onSort }: Props) {
  if (view === 'areas') return null;
  const apt = view === 'apartments';
  const label = apt ? 'Max rent' : 'Max price';
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-dusk">
        <span className="hidden font-medium sm:inline">{label}</span>
        <PriceSlider compact mode={apt ? 'rent' : 'buy'} label={label} value={budget} onChange={onBudget} />
      </div>
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
