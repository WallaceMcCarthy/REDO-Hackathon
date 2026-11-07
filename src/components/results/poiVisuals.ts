export type PoiKind = 'restaurant' | 'trail' | 'ski' | 'school';

export const POI_VISUALS: ReadonlyArray<{ kind: PoiKind; label: string; shape: string; color: string }> = [
  { kind: 'restaurant', label: 'Food', shape: '◆', color: '#be4b32' },
  { kind: 'trail', label: 'Trails', shape: '▲', color: '#28786f' },
  { kind: 'ski', label: 'Ski', shape: '●', color: '#3b62a3' },
  { kind: 'school', label: 'Schools', shape: '■', color: '#76509b' },
];

export const POI_VISUAL_BY_KIND = Object.fromEntries(POI_VISUALS.map(visual => [visual.kind, visual])) as Record<PoiKind, (typeof POI_VISUALS)[number]>;
