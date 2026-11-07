import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rankTowns } from '../convex/lib/scoring';
import { defaultPrefs, parseBudget, parsePrefs, toMetricWeights } from './prefs';
import type { City, Metric } from './types';

const dir = 'data/metrics';
const metrics: Metric[] = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const cities: City[] = JSON.parse(readFileSync('data/cities.json', 'utf8'));
const NEW_COST_METRICS = ['price_to_income', 'rent_burden'];

const costShare = (list: Metric[], weights: Record<string, number>) => {
  const total = list.reduce((sum, m) => sum + weights[m.id], 0);
  return list.filter(m => m.category === 'cost').reduce((sum, m) => sum + weights[m.id], 0) / total;
};

describe('toMetricWeights', () => {
  const equal = defaultPrefs().categories;
  const before = metrics.filter(m => !NEW_COST_METRICS.includes(m.id));

  it('keeps the Cost share where it was before the affordability metrics, with all sliders equal', () => {
    expect(metrics.filter(m => m.category === 'cost').length).toBeGreaterThan(3);
    expect(costShare(metrics, toMetricWeights(equal, metrics))).toBeCloseTo(costShare(before, toMetricWeights(equal, before)), 3);
  });

  it('leaves every other category at its slider value', () => {
    const weights = toMetricWeights(equal, metrics);
    for (const m of metrics.filter(x => x.category !== 'cost')) expect(weights[m.id]).toBe(equal[m.category]);
  });

  it('does not boost Cost when fewer than three metrics exist', () => {
    const one = metrics.filter(m => m.category === 'cost').slice(0, 1);
    expect(toMetricWeights(equal, one)[one[0].id]).toBe(equal.cost);
  });

  it('a Cost slider of zero still removes Cost from the score', () => {
    const weights = toMetricWeights({ ...equal, cost: 0 }, metrics);
    for (const m of metrics.filter(x => x.category === 'cost')) expect(weights[m.id]).toBe(0);
  });

  it('keeps the same top five towns as before the affordability metrics', () => {
    const top = (list: Metric[]) => rankTowns(cities, list, toMetricWeights(equal, list)).slice(0, 5).map(t => t.cityId).sort();
    expect(top(metrics)).toEqual(top(before));
  });
});

describe('parseBudget', () => {
  it.each([
    ['500000', 500000], ['$500,000', 500000], ['500k', 500000], ['1.2M', 1200000], ['2.5K', 2500], ['$1,500', 1500],
    ['', undefined], ['abc', undefined], ['0', undefined], ['.', undefined],
  ])('reads %s', (raw, expected) => {
    expect(parseBudget(raw)).toBe(expected);
  });
});

describe('parsePrefs', () => {
  const stored = { ...defaultPrefs(), budget: { maxRent: 1500 }, personas: ['skier'] };

  it('restores valid saved prefs', () => {
    expect(parsePrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it.each([
    ['nothing saved', null],
    ['broken JSON', '{oops'],
    ['wrong shape', '{"categories":[]}'],
    ['a weight out of range', JSON.stringify({ ...stored, categories: { ...stored.categories, cost: 9 } })],
    ['a missing category', JSON.stringify({ ...stored, categories: { cost: 2 } })],
  ])('falls back to defaults for %s', (_, raw) => {
    expect(parsePrefs(raw)).toEqual(defaultPrefs());
  });

  it('drops persona ids that no longer exist', () => {
    expect(parsePrefs(JSON.stringify({ ...stored, personas: ['skier', 'retired'] })).personas).toEqual(['skier']);
  });
});
