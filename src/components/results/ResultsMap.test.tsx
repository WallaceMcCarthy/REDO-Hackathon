import { describe, expect, it } from 'vitest';
import { AREA_MAP_LABEL_LAYOUT } from './ResultsMap';

describe('Areas map label layout', () => {
  it('uses collision detection for ranks and avoids duplicating basemap town names', () => {
    expect(AREA_MAP_LABEL_LAYOUT).toEqual({
      townNamesVisibility: 'none',
      ranksAllowOverlap: false,
      ranksIgnorePlacement: false,
    });
  });
});
