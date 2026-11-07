// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import type { Metric } from '../../types';
import { stepLayer } from './LayerPicker';
import LayerPicker from './LayerPicker';

describe('stepLayer', () => {
  const ids = ['', 'air', 'water'];

  it('steps through layers and stops at either end', () => {
    expect(stepLayer(ids, '', 1)).toBe('air');
    expect(stepLayer(ids, 'air', 1)).toBe('water');
    expect(stepLayer(ids, 'water', 1)).toBe('water');
    expect(stepLayer(ids, '', -1)).toBe('');
  });
});

describe('scroll-select dial', () => {
  it('selects the option nearest the centre after scrolling settles', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    const metric = (id: string): Metric => ({
      id, label: id, category: 'cost', unit: '$', higherIsBetter: false,
      description: '', source: '', sourceUrl: '', year: 2026, values: { provo: 1 },
    });
    const onSelect = vi.fn();
    render(<LayerPicker metrics={[metric('air'), metric('water')]} selected={undefined} onSelect={onSelect} />);
    const dial = screen.getByRole('listbox', { name: 'Map heatmap layer' });
    const options = screen.getAllByRole('option');
    vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 100 } as DOMRect);
    options.forEach((option, index) => vi.spyOn(option, 'getBoundingClientRect').mockReturnValue({ top: index * 45, height: 20 } as DOMRect));

    fireEvent.scroll(dial);
    vi.advanceTimersByTime(150);

    expect(onSelect).toHaveBeenCalledWith('air');
    vi.useRealTimers();
  });
});
