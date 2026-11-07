// Towns (lat/lng/population) from Wikidata, cached in data/raw/towns.json.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
const IDS = "salt-lake-city, west-valley-city, west-jordan, provo, orem, sandy, st-george, ogden, layton, south-jordan, lehi, millcreek, taylorsville, herriman, logan, murray, draper, bountiful, riverton, spanish-fork, roy, pleasant-grove, cedar-city, kaysville, cottonwood-heights, holladay, eagle-mountain, saratoga-springs, american-fork, park-city, heber-city, midway, moab, vernal, price, tooele, brigham-city, richfield, kanab, hurricane, washington, ephraim".split(", ");
const SPECIAL: Record<string, string> = { "salt-lake-city": "Salt Lake City", "west-valley-city": "West Valley City", "st-george": "St. George, Utah" };
export type Town = { id: string; lat: number; lng: number; population: number };
const title = (id: string) => SPECIAL[id] ?? id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ") + ", Utah";
const UA = { "User-Agent": "utahfit-hackathon/1.0" };
const CACHE = "data/raw/towns.json";
export async function loadTowns(): Promise<Town[]> {
  if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, "utf8"));
  const titles = IDS.map(title);
  const q = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=" + encodeURIComponent(titles.join("|")), { headers: UA })).json();
  const norm: Record<string, string> = {};
  for (const n of [...(q.query.normalized ?? []), ...(q.query.redirects ?? [])]) norm[n.from] = n.to;
  const byTitle: Record<string, string> = {};
  for (const p of Object.values<any>(q.query.pages)) byTitle[p.title] = p.pageprops?.wikibase_item;
  const qid = IDS.map((_, i) => { let x = titles[i]; for (let k = 0; k < 3; k++) x = norm[x] ?? x; return byTitle[x]; });
  if (qid.some(x => !x)) throw new Error("missing qid");
  const e = await (await fetch("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" + qid.join("|"), { headers: UA })).json();
  const out: Town[] = IDS.map((id, i) => {
    const c = e.entities[qid[i]].claims, co = c.P625[0].mainsnak.datavalue.value;
    const pops = (c.P1082 ?? []).filter((p: any) => p.rank !== "deprecated").map((p: any) => ({ t: p.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "", v: Number(p.mainsnak.datavalue.value.amount) })).sort((a: any, b: any) => a.t.localeCompare(b.t));
    return { id, lat: co.latitude, lng: co.longitude, population: pops.at(-1)!.v };
  });
  mkdirSync("data/raw", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(out, null, 1));
  return out;
}
