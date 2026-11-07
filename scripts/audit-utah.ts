/** Read-only operator wrapper. Uses the existing Convex CLI login; never reads or prints credentials.
 * npx tsx scripts/audit-utah.ts [--prod] [--assessor] [--max-pages=1]
 */
import { execFileSync } from 'node:child_process';

type Page = { checked: number; matched: number; isDone: boolean; continueCursor: string | null;
  eligibleOutsideTown?: number; unlocatedPricedResidential?: number; examples: unknown[] };
const args = process.argv.slice(2);
if (args.some(a => !['--prod', '--assessor'].includes(a) && !/^--max-pages=\d+$/.test(a))) throw new Error('Only --prod, --assessor and --max-pages=N are supported. This command cannot delete.');
const maxPages = Number(args.find(a => a.startsWith('--max-pages='))?.split('=')[1] ?? 10000);
if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error('Invalid page limit.');
const prod = args.includes('--prod');
const scopes = [
  { name: 'marketListings', fn: 'marketSeed:purgeNonUtahPage', extra: { dryRun: true } },
  { name: 'listings', fn: 'marketSeed:auditLegacyUtahPage', extra: {} },
  ...(args.includes('--assessor') ? [{ name: 'assessorListings', fn: 'marketSeed:auditLegacyUtahPage', extra: { table: 'assessorListings' } }] : []),
];

for (const scope of scopes) {
  let cursor: string | null = null;
  const summary = { table: scope.name, complete: false, pages: 0, checked: 0, matched: 0,
    eligibleOutsideTown: 0, unlocatedPricedResidential: 0, examples: [] as unknown[] };
  for (let i = 0; i < maxPages; i++) {
    const output = execFileSync('npx', ['--no-install', 'convex', 'run', scope.fn,
      JSON.stringify({ ...scope.extra, cursor }), ...(prod ? ['--prod'] : []), '--typecheck', 'disable'],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    const page: Page = JSON.parse(output.trim());
    summary.pages++;
    summary.checked += page.checked; summary.matched += page.matched;
    summary.eligibleOutsideTown += page.eligibleOutsideTown ?? 0;
    summary.unlocatedPricedResidential += page.unlocatedPricedResidential ?? 0;
    summary.examples.push(...page.examples.slice(0, Math.max(0, 5 - summary.examples.length)));
    if (summary.pages % 25 === 0) console.error(`${scope.name}: checked ${summary.checked}, matched ${summary.matched}`);
    if (page.isDone) { summary.complete = true; break; }
    if (!page.continueCursor || page.continueCursor === cursor) throw new Error('Audit cursor did not advance.');
    cursor = page.continueCursor;
  }
  console.log(JSON.stringify({ target: prod ? 'production' : 'configured development/local', dryRun: true, ...summary }, null, 2));
}
