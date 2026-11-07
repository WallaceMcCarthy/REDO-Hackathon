import { describe, expect, it } from 'vitest';
import { cellLatLng, colorScale, computeGrid, confidenceAt, insideUtah } from './heatmap';

const COLS = 40, ROWS = 40;
const at = (col: number, row: number, value: number) => ({ lat: cellLatLng(col, row, COLS, ROWS)[0], lng: cellLatLng(col, row, COLS, ROWS)[1], value });
const cell = (g: ReturnType<typeof computeGrid>, col: number, row: number) => g.values[row * g.cols + col];

describe('computeGrid', () => {
  const a = at(10, 30, 10), b = at(30, 30, 20);

  it('returns a town value at the town', () => {
    const g = computeGrid([a, b], COLS, ROWS);
    expect(cell(g, 10, 30)).toBeCloseTo(10, 4);
    expect(cell(g, 30, 30)).toBeCloseTo(20, 4);
  });

  it('lies between neighbours midway', () => {
    const mid = cell(computeGrid([a, b], COLS, ROWS), 20, 30);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(20);
  });

  it('is NaN outside Utah, including the northeast notch', () => {
    const g = computeGrid([a, b], COLS, ROWS);
    expect(cell(g, 39, 0)).toBeNaN();
    expect(cell(g, 39, 5)).toBeNaN();
    expect(cell(g, 5, 5)).not.toBeNaN();
  });

  it('ignores a town with no value', () => {
    const g = computeGrid([a, b, { ...at(20, 20, NaN) }], COLS, ROWS);
    expect(g.values.some(v => v > 20.0001)).toBe(false);
    expect(cell(g, 20, 20)).toBeGreaterThan(10);
  });
});

describe('colorScale', () => {
  const vals = [1, 2, 3, 100];
  it('makes the best end green and the worst red', () => {
    const hi = colorScale(vals, true), lo = colorScale(vals, false);
    expect(hi(100)[1]).toBeGreaterThan(hi(100)[0]);
    expect(hi(1)[0]).toBeGreaterThan(hi(1)[1]);
    expect(lo(1)).toEqual(hi(100));
    expect(lo(100)).toEqual(hi(1));
  });
  it('spreads a skewed metric across the ramp', () => {
    const c = colorScale(vals, true);
    expect(c(3)).not.toEqual(c(100));
    expect(c(2)).not.toEqual(c(1));
  });
  it('leaves NaN cells transparent', () => {
    expect(colorScale(vals, true)(NaN)[3]).toBe(0);
  });
});

describe('confidence', () => {
  it('is full near a town and gone far from any', () => {
    expect(confidenceAt(10)).toBe(1);
    expect(confidenceAt(50)).toBeCloseTo(0.5);
    expect(confidenceAt(100)).toBe(0);
  });

  it('shows nothing in the empty northwest corner when towns are in the south', () => {
    const grid = computeGrid([{ lat: 37.1, lng: -113.6, value: 1 }, { lat: 37.7, lng: -113.1, value: 2 }], 60, 60);
    let corner = -1;
    for (let i = 0; i < grid.values.length; i++) {
      const [lat, lng] = cellLatLng(i % 60, Math.floor(i / 60), 60, 60);
      if (lat > 41.5 && lng < -113.5 && insideUtah(lat, lng)) corner = i;
    }
    expect(corner).toBeGreaterThan(-1);
    expect(grid.confidence[corner]).toBe(0);
  });
});
