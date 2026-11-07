// Pro / NCAA D1 venues in Utah; coordinates from Wikipedia.
import { loadTowns } from "./townpop.ts";
import { haversineKm, wikiCoords, writeMetric } from "./osmlib.ts";
const V: Record<string, string> = {
  "Delta Center": "Delta Center", "America First Field": "America First Field", "Rice-Eccles Stadium": "Rice–Eccles Stadium",
  "LaVell Edwards Stadium": "LaVell Edwards Stadium", "Maverik Center": "Maverik Center", "Jon M. Huntsman Center": "Jon M. Huntsman Center",
  "Dee Events Center": "Dee Events Center", "Stewart Stadium": "Stewart Stadium", "Romney Stadium": "Romney Stadium",
  "Greater Zion Stadium": "Greater Zion Stadium", "Cedar City: Eccles Coliseum": "Eccles Coliseum", "Utah Valley: UCCU Center": "UCCU Center",
  "Smith Spectrum": "Dee Glen Smith Spectrum", "Marriott Center": "Marriott Center", "Energy Solutions Arena": "",
};
const main = async () => {
  delete V["Energy Solutions Arena"];
  const towns = await loadTowns();
  const c = await wikiCoords(Object.values(V));
  const pts = Object.entries(V).filter(([, t]) => c[t]).map(([n, t]) => ({ n, p: c[t] }));
  const values: Record<string, number> = {};
  for (const t of towns) {
    let best = Infinity, bn = "";
    for (const u of pts) { const d = haversineKm([t.lat, t.lng], u.p); if (d < best) { best = d; bn = u.n; } }
    values[t.id] = Math.round(best * 10) / 10; console.log(t.id, values[t.id], bn);
  }
  writeMetric("data/metrics/sports.json", {
    id: "sports", label: "Distance to pro/college sports", category: "culture", unit: "km to nearest pro or NCAA D1 venue", higherIsBetter: false,
    description: `Straight-line km from town center to the nearest pro or NCAA Division I venue: ${pts.map(u => u.n).join("; ")}.`,
    source: "Venue coordinates from Wikipedia", sourceUrl: "https://en.wikipedia.org/wiki/List_of_sports_venues_in_Utah", year: 2025, values,
  });
};
main();
