import type { PoiKind } from './PoiLayer';

const OPTIONS: { kind: PoiKind; label: string; shape: string; color: string }[] = [
  { kind: 'restaurant', label: 'Food', shape: '◆', color: '#be4b32' },
  { kind: 'trail', label: 'Trails', shape: '▲', color: '#28786f' },
  { kind: 'ski', label: 'Ski', shape: '✦', color: '#3b62a3' },
  { kind: 'school', label: 'Schools', shape: '■', color: '#76509b' },
];

type Props = { enabled: ReadonlySet<PoiKind>; onToggle: (kind: PoiKind) => void };

export default function PoiToggle({ enabled, onToggle }: Props) {
  return (
    <div aria-label="Nearby places" className="absolute bottom-4 left-3 z-10 flex max-w-[calc(100%-1.5rem)] gap-1 overflow-x-auto rounded-control border border-border bg-surface/95 p-1 shadow-card backdrop-blur-sm">
      {OPTIONS.map(({ kind, label, shape, color }) => {
        const active = enabled.has(kind);
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(kind)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-caption font-semibold transition ${active ? 'bg-text text-white' : 'text-text hover:bg-surface-sunken'}`}
          >
            <span aria-hidden style={{ color: active ? 'white' : color }} className="text-base leading-none">{shape}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
