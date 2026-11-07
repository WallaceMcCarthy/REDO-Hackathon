import type { Row } from './types';
import { FOCUS, LINK, money, rentFmt } from '../homes/ui';

type Props = {
  row: Row;
  active: boolean;
  medianValue?: number;
  medianRent?: number;
  onOpen: () => void;
  onSeeHomes: () => void;
  onHover: (on: boolean) => void;
};

export default function TownCard({ row, active, medianValue, medianRent, onOpen, onSeeHomes, onHover }: Props) {
  const { city, score, rank } = row;
  const pct = Math.max(0, Math.min(100, Math.round(score.score)));
  return (
    <article
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`rounded-xl border bg-white p-4 transition-colors ${active ? 'border-alpine-500 ring-2 ring-alpine-500/20' : 'border-rock-100 hover:border-rock-300'}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rock-100 text-sm font-bold text-rock-800 tabular-nums" aria-label={`Rank ${rank}`}>{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl leading-tight text-ink">{city.name}</h3>
          <p className="text-xs text-dusk">{city.county} County</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span role="meter" aria-label={`${city.name} fit score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="block h-1.5 flex-1 overflow-hidden rounded-full bg-rock-100">
          <span className="block h-full rounded-full bg-alpine-500" style={{ width: `${pct}%` }} />
        </span>
        <span className="w-16 text-right text-xs tabular-nums text-dusk">{pct} / 100</span>
      </div>

      {score.highlights.length > 0 && (
        <p className="mt-2 text-xs text-ink"><span className="font-semibold text-alpine-700">Why it fits: </span>{score.highlights.slice(0, 3).join(' · ')}</p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-rock-50 p-3">
        <div>
          <dt className="text-xs text-dusk">Median home value</dt>
          <dd className="font-display text-lg text-ink tabular-nums">{medianValue != null ? money(medianValue) : 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-xs text-dusk">Median rent</dt>
          <dd className="font-display text-lg text-ink tabular-nums">{medianRent != null ? rentFmt(medianRent) : 'N/A'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rock-100 pt-3">
        <button type="button" onClick={onSeeHomes} className={`cursor-pointer rounded-lg bg-rock-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rock-800 ${FOCUS}`}>
          See homes in {city.name}
        </button>
        <button type="button" onClick={onOpen} className={LINK}>About {city.name}</button>
      </div>
    </article>
  );
}
