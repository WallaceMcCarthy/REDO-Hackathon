// Run: npx esbuild src/components/detail/compare.check.ts --bundle --platform=node | node
import type { Metric } from '../../types';
import { compare, median } from './compare';

function eq(actual: unknown, expected: unknown, name: string) {
  if (actual !== expected) throw new Error(`FAIL ${name}: got ${actual}, expected ${expected}`);
  console.log(`ok   ${name}`);
}

eq(median([3, 1, 2]), 2, 'odd count');
eq(median([4, 1, 3, 2]), 2.5, 'even count');
eq(median([]), undefined, 'empty');
eq(median([5]), 5, 'single value');

const m = (higherIsBetter: boolean, values: Record<string, number>) => ({ higherIsBetter, values }) as Metric;
const values = { a: 1, b: 2, c: 3, d: 10 };
eq(compare(m(false, values), 'missing').verdict, 'none', 'town missing a value');
eq(compare(m(false, values), 'missing').median, 2.5, 'median ignores missing town');
eq(compare(m(false, values), 'a').verdict, 'better', 'lower is better, below median');
eq(compare(m(true, values), 'a').verdict, 'worse', 'higher is better, below median');
eq(compare(m(true, { a: 1, b: 2, c: 3 }), 'b').verdict, 'typical', 'equal to median');
console.log('all median checks passed');
