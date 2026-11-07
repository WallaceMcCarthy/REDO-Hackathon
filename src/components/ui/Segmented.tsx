import { useRef, type KeyboardEvent } from 'react';

type SegmentedProps<T extends string> = {
  /** Accessible name of the group, for example "Show". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Where a radio group's arrow, Home and End keys land, or null for any other key. */
export function nextIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function Segmented<T extends string>({ label, options, value, onChange, className = '' }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const selected = options.findIndex(o => o.value === value);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const next = nextIndex(e.key, index, options.length);
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next].focus();
  }

  return (
    <div ref={group} role="radiogroup" aria-label={label} className={`flex gap-1 rounded-pill bg-surface-sunken p-1 ${className}`}>
      {options.map((option, i) => {
        const on = i === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            // Roving tabindex: Tab enters at the selected option, arrows move within the group.
            tabIndex={on || (selected === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`min-h-11 flex-1 cursor-pointer rounded-pill px-3 text-small font-semibold transition-colors ${
              on ? 'bg-primary text-on-primary shadow-sm' : 'text-primary-hover hover:bg-rock-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
