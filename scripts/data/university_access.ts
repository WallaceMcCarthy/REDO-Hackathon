// Utah 4-year institutions (IPEDS / College Navigator list); coordinates fetched from Wikipedia.
import { loadTowns } from "./townpop.ts";
import { haversineKm, wikiCoords, writeMetric } from "./osmlib.ts";
const UNIS: Record<string, string> = {
  "University of Utah": "University of Utah", "Utah State University": "Utah State University", "Brigham Young University": "Brigham Young University",
  "Weber State University": "Weber State University", "Southern Utah University": "Southern Utah University", "Utah Valley University": "Utah Valley University",
  "Utah Tech University": "Utah Tech University", "Westminster University": "Westminster University (Utah)", "Snow College": "Snow College",
  "Utah State University Eastern (Price)": "Utah State University Eastern",
  "Salt Lake Community College (excluded: 2-yr)": "",
};
const main = async () => {
  delete UNIS["Salt Lake Community College (excluded: 2-yr)"];
  const towns = await loadTowns();
  const c = await wikiCoords(Object.values(UNIS));
  const pts = Object.entries(UNIS).filter(([, t]) => c[t]).map(([n, t]) => ({ n, p: c[t] }));
  const values: Record<string, number> = {};
  for (const t of towns) {
    let best = Infinity, bn = "";
    for (const u of pts) { const d = haversineKm([t.lat, t.lng], u.p); if (d < best) { best = d; bn = u.n; } }
    values[t.id] = Math.round(best * 10) / 10; console.log(t.id, values[t.id], bn);
  }
  writeMetric("data/metrics/university_access.json", {
    id: "university_access", label: "Distance to a university", category: "education", unit: "km to nearest 4-year university/college", higherIsBetter: false,
    description: `Straight-line km from town center to the nearest of ${pts.length} Utah public/private universities and colleges: ${pts.map(u => u.n).join("; ")}. Coordinates from Wikipedia.`,
    source: "Institution list per NCES College Navigator; coordinates from Wikipedia", sourceUrl: "https://nces.ed.gov/collegenavigator/?s=UT&l=93&ct=2+3", year: 2025, values,
  });
};
main();
