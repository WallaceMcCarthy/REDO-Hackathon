import type { LatLngBoundsExpression } from 'leaflet';
import { useMemo } from 'react';
import { ImageOverlay } from 'react-leaflet';
import type { City, Metric } from '../../types';
import { BOUNDS, computeGrid, gridToDataUrl } from './heatmap';

const OVERLAY_BOUNDS: LatLngBoundsExpression = [[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]];

/** One image per metric. Nothing here runs on zoom or pan, and a weight slider never reaches it. */
export default function HeatmapLayer({ metric, cities }: { metric: Metric; cities: City[] }) {
  const url = useMemo(() => {
    const points = cities.flatMap(c => (metric.values[c.id] === undefined ? [] : [{ lat: c.lat, lng: c.lng, value: metric.values[c.id] }]));
    return gridToDataUrl(computeGrid(points), points.map(p => p.value), metric.higherIsBetter);
  }, [metric, cities]);
  return url ? <ImageOverlay url={url} bounds={OVERLAY_BOUNDS} opacity={0.65} interactive={false} /> : null;
}
