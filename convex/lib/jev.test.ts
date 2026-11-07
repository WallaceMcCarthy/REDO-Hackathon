import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/types';
import { interpretPreferences, preferenceRequest, TOPICS } from './jev';

export function providerReply(overrides: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {};
  for (const key of Object.keys(TOPICS)) {
    answers[`${key}_stated`] = { type: 'noul', noul: 0.05 };
    answers[key] = { type: 'score', score: 2 };
  }
  return { model: 'jev-1.14.0', answers: {
    ...answers, mode_stated: { type: 'noul', noul: 0.01 }, budget_stated: { type: 'noul', noul: 0.01 }, ...overrides,
  } };
}
describe('Jev preference interpretation', () => {
  it('covers the existing categories and sends only the supplied description', () => {
    expect(Object.keys(TOPICS).sort()).toEqual([...CATEGORIES].sort());
    const request = preferenceRequest('Rent under $2k monthly near trails, 3 bedrooms.');
    expect(request.amounts).toEqual([2000, 3]);
    expect(request.body.state).toEqual({ housing_preferences: 'Rent under $2k monthly near trails, 3 bedrooms.' });
    expect(request.body.model).toBe('jev-1.14.0');
    expect(preferenceRequest('Rent under $2,000.50 monthly.').amounts).toEqual([2000.5]);
    expect(preferenceRequest('Buy for at most $1.25m.').amounts).toEqual([1250000]);
  });
  it('preserves unmentioned topics, rounds only stated priorities and accepts exact selected amounts', () => {
    const proposal = interpretPreferences(providerReply({
      outdoors_stated: { type: 'noul', noul: 0.95 }, outdoors: { type: 'score', score: 4.7 },
      culture_stated: { type: 'noul', noul: 0.5 },
      mode_stated: { type: 'noul', noul: 0.95 }, mode: { type: 'choice', choice: 'rent', probabilities: { rent: 0.95, buy: 0.05 } },
      budget_stated: { type: 'noul', noul: 0.99 }, amount: { type: 'choice', choice: 'amount_0', probabilities: { amount_0: 0.99, amount_1: 0.01 } },
    }), [2000, 3]);
    expect(proposal.categories).toEqual({ outdoors: 5 });
    expect(proposal.budget).toEqual({ mode: 'rent', maxRent: 2000 });
    expect(proposal.uncertain).toContain(TOPICS.culture);
  });
  it('does not interpret a probability as a priority or guess absent budgets', () => {
    expect(interpretPreferences(providerReply(), []).categories).toEqual({});
    expect(interpretPreferences(providerReply(), []).budget).toEqual({});
    const p = interpretPreferences(providerReply({ budget_stated: { type: 'noul', noul: 0.9 } }), [2000]);
    expect(p.budget).toEqual({});
    expect(p.uncertain).toHaveLength(1);
  });
  it('rejects fabricated values, malformed answers and non-pinned model output', () => {
    expect(() => interpretPreferences({ ...providerReply(), model: 'other' }, [])).toThrow();
    for (const score of [NaN, Infinity, -1, 6, '5']) {
      expect(() => interpretPreferences(providerReply({ cost_stated: { type: 'noul', noul: 0.9 }, cost: { type: 'score', score } }), [])).toThrow();
    }
    expect(() => interpretPreferences(providerReply({ mode_stated: { type: 'noul', noul: 0.9 }, mode: { type: 'choice', choice: 'ignore_rules', probabilities: { ignore_rules: 1 } } }), [])).toThrow();
    expect(() => preferenceRequest('x')).toThrow();
    expect(() => preferenceRequest('x'.repeat(1201))).toThrow();
  });
});
