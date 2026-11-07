import type { Row } from './types';

type Props = {
  row: Row;
  active: boolean;
  onOpen: () => void;
  onHover: (on: boolean) => void;
};

export default function TownCard({ row, active, onOpen, onHover }: Props) {
  const { city, score, rank } = row;
  const top = rank <= 3;
  const pct = Math.max(0, Math.min(100, score.score));
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`flex w-full gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500 ${
        active ? 'border-rock-500 bg-white shadow-md' : 'border-rock-100 bg-rock-50/60 hover:border-rock-300'
      }`}
    >
      <span className={`w-9 shrink-0 text-right font-display leading-none ${top ? 'text-4xl text-rock-600' : 'text-3xl text-dusk'}`}>
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-display text-xl text-ink">{city.name}</span>
          <span className="shrink-0 text-sm tabular-nums text-dusk">{Math.round(pct)} / 100</span>
        </span>
        <span className="block text-sm text-dusk">{city.county} County</span>
        <span
          role="meter" aria-label={`${city.name} fit score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
          className="mt-2 block h-2 overflow-hidden rounded-full bg-rock-100"
        >
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ${top ? 'bg-rock-500' : 'bg-alpine-500'}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        {score.highlights.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {score.highlights.map(h => (
              <span key={h} className="rounded-full bg-alpine-50 px-2 py-0.5 text-xs text-alpine-700">{h}</span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
