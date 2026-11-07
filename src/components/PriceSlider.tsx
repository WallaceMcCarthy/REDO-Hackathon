const SPEC = {
  buy: { min: 100_000, max: 2_000_000, step: 25_000 },
  rent: { min: 500, max: 5_000, step: 50 },
} as const;

export function priceLabel(mode: 'buy' | 'rent', v?: number): string {
  if (v === undefined) return 'Any price';
  return mode === 'buy' ? `Up to $${v.toLocaleString('en-US')}` : `Up to $${v.toLocaleString('en-US')}/mo`;
}

// The far-right stop (one step past max) means no limit and maps to undefined.
export default function PriceSlider({ mode, value, onChange, label, compact }: {
  mode: 'buy' | 'rent'; value?: number; onChange: (n?: number) => void; label: string; compact?: boolean;
}) {
  const { min, max, step } = SPEC[mode];
  const top = max + step;
  const text = priceLabel(mode, value);
  return (
    <div className={compact ? 'flex items-center gap-2' : 'block'}>
      <output className={compact ? 'min-w-24 text-sm font-medium text-ink' : 'block font-display text-heading text-text'} aria-hidden="true">{text}</output>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={text}
        min={min}
        max={top}
        step={step}
        value={value ?? top}
        onChange={e => { const n = Number(e.target.value); onChange(n >= top ? undefined : n); }}
        className={`${compact ? 'w-36' : 'mt-2 w-full'} h-6 cursor-pointer accent-primary`}
      />
    </div>
  );
}
