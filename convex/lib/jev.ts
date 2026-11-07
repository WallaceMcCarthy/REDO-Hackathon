/** Question wording and interpretation stay together. No credentials or user text are logged. */
export const TOPICS = {
  cost: 'affordability and cost of living', safety: 'crime and public safety',
  environment: 'environmental quality', outdoors: 'outdoor recreation, skiing and trails',
  transit: 'public transit and commuting', culture: 'restaurants, arts and nightlife',
  education: 'schools and education', community: 'community and civic participation',
} as const;
export type Topic = keyof typeof TOPICS;
export type PreferenceProposal = {
  categories: Partial<Record<Topic, number>>;
  budget: { mode?: 'buy' | 'rent'; maxValue?: number; maxRent?: number };
  uncertain: string[];
  model: string;
};
type Question = { type: 'noul' | 'score' | 'choice'; instructions: string; criteria?: unknown };
const record = (x: unknown): Record<string, any> => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Invalid Jev response');
  return x as Record<string, any>;
};
function number(x: unknown, max = 1): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > max) throw new Error('Invalid Jev response');
  return x;
}
export function preferenceRequest(raw: string) {
  const text = raw.trim();
  if (text.length < 5 || text.length > 1200) throw new Error('Describe your preferences in 5 to 1,200 characters.');
  // Code extracts exact numeric candidates; the model can select one, never invent an amount.
  const amounts = [...new Set([...text.matchAll(/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([km])?\b/gi)]
    .map(m => Number(m[1].replaceAll(',', '')) * (m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' ? 1000000 : 1))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 100000000))].slice(0, 12);
  const questions: Record<string, Question> = {};
  for (const [key, topic] of Object.entries(TOPICS)) {
    questions[`${key}_stated`] = { type: 'noul', instructions: `Does the home seeker's description express a preference about ${topic}?` };
    questions[key] = { type: 'score', instructions: `How important is ${topic} to this home seeker?`, criteria: [
      'The person explicitly says this does not matter.', 'The person gives this very little priority.',
      'The person sees this as a nice extra.', 'The person gives this moderate priority.',
      'The person gives this strong priority.', 'The person says this is essential or their highest priority.',
    ] };
  }
  questions.mode_stated = { type: 'noul', instructions: 'Does the description clearly state whether the person wants to buy or rent a home?' };
  questions.mode = { type: 'choice', instructions: 'Does the person want to buy or rent their next home?', criteria: { buy: 'Purchase a home.', rent: 'Rent a home or apartment.' } };
  questions.budget_stated = { type: 'noul', instructions: 'Does the description state one unambiguous maximum home purchase price or maximum monthly housing rent in US dollars?' };
  if (amounts.length) questions.amount = { type: 'choice', instructions: 'Which candidate is the stated maximum purchase price or monthly rent, in US dollars?', criteria: Object.fromEntries(amounts.map((n, i) => [`amount_${i}`, `${n} US dollars`])) };
  return { amounts, body: { model: 'jev-1.14.0', state: { housing_preferences: text }, questions } };
}

export function interpretPreferences(raw: unknown, amounts: number[]): PreferenceProposal {
  const response = record(raw), answers = record(response.answers);
  if (response.model !== 'jev-1.14.0') throw new Error('Unexpected Jev model');
  const result: PreferenceProposal = { categories: {}, budget: {}, uncertain: [], model: response.model };
  const presence = (id: string) => {
    const a = record(answers[id]);
    if (a.type !== 'noul') throw new Error('Invalid Jev response');
    return number(a.noul);
  };
  const choice = (id: string, allowed: string[]) => {
    const a = record(answers[id]), probabilities = record(a.probabilities);
    if (a.type !== 'choice' || !allowed.includes(a.choice)) throw new Error('Invalid Jev response');
    const p = number(probabilities[a.choice]);
    return p >= 0.7 ? a.choice as string : null;
  };
  for (const key of Object.keys(TOPICS) as Topic[]) {
    const stated = presence(`${key}_stated`);
    if (stated >= 0.7) {
      const a = record(answers[key]);
      if (a.type !== 'score') throw new Error('Invalid Jev response');
      result.categories[key] = Math.round(number(a.score, 5));
    } else if (stated > 0.3) result.uncertain.push(TOPICS[key]);
  }
  if (presence('mode_stated') >= 0.7) {
    const mode = choice('mode', ['buy', 'rent']);
    if (mode) result.budget.mode = mode as 'buy' | 'rent';
    else result.uncertain.push('buying or renting');
  }
  if (presence('budget_stated') >= 0.7) {
    if (amounts.length && result.budget.mode) {
      const selected = choice('amount', amounts.map((_, i) => `amount_${i}`));
      if (selected) {
        const value = amounts[Number(selected.slice(7))];
        if (result.budget.mode === 'buy') result.budget.maxValue = value;
        else if (value <= 100000) result.budget.maxRent = value;
        else result.uncertain.push('monthly rent amount');
      } else result.uncertain.push('budget amount');
    } else result.uncertain.push('budget amount and whether it is a purchase or monthly rent');
  }
  return result;
}
