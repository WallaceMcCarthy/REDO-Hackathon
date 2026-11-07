// Run: npx esbuild src/components/detail/compare.check.ts --bundle --platform=node | node
import type { Metric } from '../../types';
import { compare, gapWords, median } from './compare';

function eq(actual: unknown, expected: unknown, name: string) {
  if (actual !== expected) throw new Error(`FAIL ${name}: got ${actual}, expected ${expected}`);
  console.log(`ok   ${name}`);
}

eq(median([3, 1, 2]), 2, 'odd count');
eq(median([4, 1, 3, 2]), 2.5, 'even count');
eq(median([]), undefined, 'empty');
eq(median([5]), 5, 'single value');
eq(gapWords(0.4), 'under 1% higher', 'tiny gap');
eq(gapWords(-37.2), '37% lower', 'lower gap');
eq(gapWords(99), '99% higher', 'just under double');
eq(gapWords(150), 'about 2.5 times as high', 'multiple');
eq(gapWords(2273), 'about 24 times as high', 'large multiple');

const m = (higherIsBetter: boolean, values: Record<string, number>) => ({ higherIsBetter, values }) as Metric;
const values = { a: 1, b: 2, c: 3, d: 10 };
eq(compare(m(false, values), 'missing').verdict, 'none', 'town missing a value');
eq(compare(m(false, values), 'missing').median, 2.5, 'median ignores missing town');
eq(compare(m(false, values), 'a').verdict, 'better', 'lower is better, below median');
eq(compare(m(true, values), 'a').verdict, 'worse', 'higher is better, below median');
eq(compare(m(true, { a: 1, b: 2, c: 3 }), 'b').verdict, 'typical', 'equal to median');
console.log('all median checks passed');
