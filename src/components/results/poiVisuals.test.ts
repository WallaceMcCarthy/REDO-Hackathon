import { describe, expect, it } from 'vitest';
import { POI_VISUAL_BY_KIND, POI_VISUALS } from './poiVisuals';

describe('POI visuals', () => {
  it('uses one shared ski glyph and color for the toggle and map layer', () => {
    const ski = POI_VISUALS.find(visual => visual.kind === 'ski');
    expect(ski).toBe(POI_VISUAL_BY_KIND.ski);
    expect(ski).toMatchObject({ shape: '●', color: '#3b62a3' });
  });
});
