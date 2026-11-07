/**
 * Writes public/data/map-points-{home,apartment}.json: every listing the app's search can return, as the map needs it.
 * The map loads these from the CDN so a page view never pulls thousands of rows through Convex.
 * Rerun after a listing import: `npx tsx scripts/data/map_points.ts`. Reads prod with public queries only.
 * Each run costs one listings:search per 300 rows, so `--from-raw` rebuilds from the last download in data/raw/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Listing, ListingKind } from "../../convex/lib/listings";
import { insideUtah } from "../../src/components/results/heatmap";
import type { MapPointsFile } from "../../src/data/mapPoints";

const CONVEX_URL = "https://dashing-wolf-264.convex.cloud";
const MAX_BYTES = 2_000_000;
const KINDS: ListingKind[] = ["home", "apartment"];
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
type Row = Pick<Listing, "id" | "cityId" | "lat" | "lng" | "value" | "rent">;

/** Keeps priced rows with real coordinates inside Utah, sorted so an unchanged snapshot writes identical bytes. */
export function toPointsFile(rows: readonly Row[], kind: ListingKind): MapPointsFile {
  const kept = rows.flatMap(({ id, cityId, lat, lng, value, rent }): MapPointsFile => {
    const price = kind === "home" ? value : rent;
    return Number.isFinite(lat) && Number.isFinite(lng) && price != null && insideUtah(lat, lng) ? [[id, round5(lat), round5(lng), price, cityId]] : [];
  });
  return kept.sort((a, b) => a[4].localeCompare(b[4]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

async function searchPage(kind: ListingKind, cursor: string | null) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${CONVEX_URL}/api/query`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "listings:search", format: "json", args: { weights: {}, kind, limit: 300, cursor } }),
      });
      const body = await res.json();
      if (body.status !== "success") throw new Error(body.errorMessage ?? `HTTP ${res.status}`);
      return body.value as { page: { listing: Listing }[]; total: number; nextCursor: string | null };
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(done => setTimeout(done, 2000 * attempt));
    }
  }
}

async function download(kind: ListingKind) {
  const rows = new Map<string, Listing>();
  let cursor: string | null = null, total = 0, calls = 0;
  do {
    const result = await searchPage(kind, cursor);
    for (const { listing } of result.page) rows.set(listing.id, listing);
    ({ nextCursor: cursor, total } = result);
    calls++;
  } while (cursor);
  console.log(`${kind}: ${rows.size} rows from ${calls} calls, search total ${total}`);
  return [...rows.values()];
}

async function main() {
  const fromRaw = process.argv.includes("--from-raw");
  mkdirSync("data/raw", { recursive: true });
  for (const kind of KINDS) {
    const raw = `data/raw/map_points_${kind}.json`;
    if (fromRaw && !existsSync(raw)) throw new Error(`${raw} is missing; run without --from-raw`);
    const rows: Listing[] = fromRaw ? JSON.parse(readFileSync(raw, "utf8")) : await download(kind);
    if (!fromRaw) writeFileSync(raw, JSON.stringify(rows));
    const points = toPointsFile(rows, kind);
    const json = JSON.stringify(points);
    if (json.length > MAX_BYTES) throw new Error(`${kind} points are ${json.length} bytes, over CONTRACT.md's 2 MB browser limit; split the file`);
    writeFileSync(`public/data/map-points-${kind}.json`, json);
    console.log(`${kind}: wrote ${points.length} points (dropped ${rows.length - points.length}), ${json.length} bytes`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
