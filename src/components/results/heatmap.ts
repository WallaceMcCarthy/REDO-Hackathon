export type Point = { lat: number; lng: number; value: number };
export type Grid = { cols: number; rows: number; values: Float32Array };
export type Rgba = [number, number, number, number];

/** Image extent. The image is drawn over exactly this box, so grid cells map to it linearly in Mercator y. */
export const BOUNDS = { south: 37, north: 42, west: -114.05, east: -109.05 };

// [lat, lng] outline of Utah.
export const UTAH: [number, number][] = [[42, -114.05], [42, -111.05], [41, -111.05], [41, -109.05], [37, -109.05], [37, -114.05]];

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmerc = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);

export function insideUtah(lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = UTAH.length - 1; i < UTAH.length; j = i++) {
    const [la, ln] = UTAH[i];
    const [lb, lm] = UTAH[j];
    if ((ln > lng) !== (lm > lng) && lat < ((lb - la) * (lng - ln)) / (lm - ln) + la) inside = !inside;
  }
  return inside;
}

/** Centre of a cell. Rows are even in Mercator y, row 0 is north. */
export function cellLatLng(col: number, row: number, cols: number, rows: number): [number, number] {
  const yN = merc(BOUNDS.north), yS = merc(BOUNDS.south);
  return [unmerc(yN - ((row + 0.5) / rows) * (yN - yS)), BOUNDS.west + ((col + 0.5) / cols) * (BOUNDS.east - BOUNDS.west)];
}

/** Inverse-distance weighting, power 2. Cells outside Utah are NaN. Non-finite point values are ignored. */
export function computeGrid(points: Point[], cols = 150, rows = 150): Grid {
  const pts = points.filter(p => Number.isFinite(p.value));
  const values = new Float32Array(cols * rows).fill(NaN);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [lat, lng] = cellLatLng(c, r, cols, rows);
      if (!pts.length || !insideUtah(lat, lng)) continue;
      const k = Math.cos((lat * Math.PI) / 180);
      let num = 0, den = 0, exact: number | undefined;
      for (const p of pts) {
        const d2 = (p.lat - lat) ** 2 + ((p.lng - lng) * k) ** 2;
        if (d2 < 1e-12) { exact = p.value; break; }
        num += p.value / d2;
        den += 1 / d2;
      }
      values[r * cols + c] = exact ?? num / den;
    }
  }
  return { cols, rows, values };
}

// Worst to best. Red rock, sand, then green, so green always reads as better.
const RAMP: Rgba[] = [[169, 76, 40, 255], [226, 165, 133, 255], [240, 228, 176, 255], [143, 197, 143, 255], [46, 139, 87, 255]];

/** Colour for t in [0,1], 0 worst and 1 best. */
export function ramp(t: number): Rgba {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  return RAMP[i].map((v, n) => Math.round(v + (RAMP[i + 1][n] - v) * f)) as Rgba;
}

export const rampCss = (higherIsBetter: boolean) => {
  const stops = [0, 0.25, 0.5, 0.75, 1].map(t => `rgb(${ramp(higherIsBetter ? t : 1 - t).slice(0, 3).join(',')})`);
  return `linear-gradient(to right, ${stops.join(',')})`;
};

/**
 * Colour scale by rank: a value maps to where it falls among the measured values, so skewed metrics
 * (transit, home value) fill the whole ramp instead of one flat colour. Ties share their mean rank.
 * shortcut: a metric whose towns all share one value gets the mid colour.
 */
export function colorScale(townValues: number[], higherIsBetter: boolean): (value: number) => Rgba {
  const s = townValues.filter(Number.isFinite).sort((a, b) => a - b);
  const n = s.length;
  const lowerBound = (v: number, strict: boolean) => {
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (strict ? s[m] <= v : s[m] < v) lo = m + 1; else hi = m; }
    return lo;
  };
  return value => {
    if (!Number.isFinite(value)) return [0, 0, 0, 0];
    if (n < 2 || s[0] === s[n - 1]) return ramp(0.5);
    const first = lowerBound(value, false), after = lowerBound(value, true);
    let idx: number;
    if (after > first) idx = (first + after - 1) / 2;
    else if (first === 0) idx = 0;
    else if (first === n) idx = n - 1;
    else idx = first - 1 + (value - s[first - 1]) / (s[first] - s[first - 1]);
    const t = idx / (n - 1);
    return ramp(higherIsBetter ? t : 1 - t);
  };
}

export function gridToDataUrl(grid: Grid, townValues: number[], higherIsBetter: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(grid.cols, grid.rows);
  const color = colorScale(townValues, higherIsBetter);
  grid.values.forEach((v, i) => img.data.set(color(v), i * 4));
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
