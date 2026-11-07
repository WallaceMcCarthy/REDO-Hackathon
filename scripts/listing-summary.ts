/** Refresh this small baseline summary whenever the assessor/HUD snapshot changes. */
import { readFile, writeFile } from "node:fs/promises";
import { listingTownMedians } from "../convex/lib/listingSearch";
import type { City } from "../convex/lib/scoring";
import type { Listing } from "../convex/lib/listings";

const root = new URL("../", import.meta.url);
const read = async (path: string) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [cities, homes, apartments] = await Promise.all([read("data/cities.json"), read("data/listings/homes.json"), read("data/listings/apartments.json")]);
await writeFile(new URL("data/listing-town-medians.json", root), JSON.stringify(listingTownMedians(cities as City[], [...homes, ...apartments] as Listing[]), null, 2) + "\n");
