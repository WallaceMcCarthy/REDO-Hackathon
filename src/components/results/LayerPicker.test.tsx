import { describe, expect, it } from 'vitest';
import { stepLayer } from './LayerPicker';

describe('stepLayer', () => {
  const ids = ['', 'air', 'water'];

  it('steps through layers and stops at either end', () => {
    expect(stepLayer(ids, '', 1)).toBe('air');
    expect(stepLayer(ids, 'air', 1)).toBe('water');
    expect(stepLayer(ids, 'water', 1)).toBe('water');
    expect(stepLayer(ids, '', -1)).toBe('');
  });
});
