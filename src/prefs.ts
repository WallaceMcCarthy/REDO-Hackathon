import { CATEGORIES, type Category, type CategoryWeights, type Metric, type Prefs, type Weights } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  cost: 'Cost of living',
  safety: 'Safety',
  environment: 'Air & water',
  outdoors: 'Outdoors',
  transit: 'Transit',
  culture: 'Culture & food',
  education: 'Education',
  community: 'Community',
};

const flat = (value: number) => Object.fromEntries(CATEGORIES.map(c => [c, value])) as CategoryWeights;

export type Persona = { id: string; label: string; tagline: string; categories: Partial<CategoryWeights> };

export const PERSONAS: Persona[] = [
  { id: 'skier', label: 'Skier', tagline: 'Close to powder, the rest can wait', categories: { outdoors: 5, environment: 3, cost: 1 } },
  { id: 'family', label: 'Family', tagline: 'Safe streets and good schools', categories: { safety: 5, education: 5, cost: 3, community: 3 } },
  { id: 'remote', label: 'Remote worker', tagline: 'Clean air, low costs, good coffee', categories: { cost: 4, environment: 4, culture: 3, outdoors: 3 } },
  { id: 'foodie', label: 'Foodie', tagline: 'Restaurants and nights out', categories: { culture: 5, transit: 3, community: 2 } },
];

export const defaultPrefs = (): Prefs => ({ categories: flat(2), filters: {}, budget: {} });

/** Personas stack: each category takes the highest value any picked persona gives it. */
export function applyPersonas(ids: string[]): CategoryWeights {
  const picked = PERSONAS.filter(p => ids.includes(p.id));
  if (!picked.length) return flat(2);
  const out = flat(0);
  for (const persona of picked) {
    for (const c of CATEGORIES) out[c] = Math.max(out[c], persona.categories[c] ?? 0);
  }
  return out;
}

// Sliders were balanced with three Cost metrics. Extra affordability metrics refine Cost, so they share that weight instead of adding to it.
const COST_METRICS_BASELINE = 3;

export function toMetricWeights(categories: CategoryWeights, metrics: Metric[]): Weights {
  const costMetrics = metrics.filter(m => m.category === 'cost').length;
  const costScale = Math.min(1, COST_METRICS_BASELINE / costMetrics);
  return Object.fromEntries(metrics.map(m => [m.id, categories[m.category] * (m.category === 'cost' ? costScale : 1)]));
}
