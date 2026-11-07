# 🏔️ Utah Fit

**Utah Fit** is an interactive, data-driven web app that helps people moving to Utah discover and rank 42 fixed Utah towns based on what matters most to them. 

Users customize their personal priorities—such as ski access, air quality, outdoor trails, transit frequency, cost of living, safety, and community culture—to receive instant, personalized rankings, detailed metric breakdowns, and an interactive geographic map.

---

## ⚡ Quickstart / Local Development

No Convex account or cloud login is required. You can run the entire stack locally with anonymous Convex dev mode:

```bash
# 1. Install dependencies
npm install

# 2. Start local Convex backend (generates .env.local automatically)
CONVEX_AGENT_MODE=anonymous npx convex dev

# 3. In another terminal, seed all 42 towns and metrics from data/
npm run seed

# 4. Start the Vite React development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to explore Utah Fit.

---

## 🏗️ Architecture & Project Structure

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS with a custom Utah palette (red rock sandstone & alpine spruce) and React Leaflet map with ranked interactive pins.
- **Backend & Database**: [Convex](https://www.convex.dev/) providing reactive queries (`api.search.rank`, `api.cities.list`, `api.cities.get`, `api.metrics.list`) and database schema validation.
- **Search & Scoring**: Pure TypeScript multi-factor ranking engine (`convex/lib/scoring.ts`) featuring min-max normalization, weight multipliers, customizable filters (`maxHomeValue`), and human-readable highlight tags.
- **Data Pipeline**: Reproducible ingestion scripts (`scripts/data/*.ts`) calculating verified public metrics stored in clean JSON contracts (`data/metrics/*.json`).

```
convex/
  schema.ts               # Database schema (cities, metrics tables)
  cities.ts               # Town list & detail queries
  metrics.ts              # Metric metadata queries
  search.ts               # Search & ranking API wrapper
  seed.ts                 # Database seed mutation
  lib/scoring.ts          # Pure scoring & persona presets engine
data/
  cities.json             # Canonical list of 42 Utah towns
  metrics/<metric>.json   # Individual public metrics with sources and town values
scripts/
  seed.ts                 # Loads data/ into Convex
  sources-table.ts        # Generates & updates data source documentation table
  data/<metric>.ts        # Reproducible data ingestion & GIS calculation scripts
src/
  App.tsx                 # Main application container
  main.tsx                # App entrypoint
```

---

## 📊 Public Data Sources

All metrics are cited from authoritative public datasets. No numbers are invented. To regenerate this table from `data/metrics/*.json`, run `npx tsx scripts/sources-table.ts`.

<!-- sources:start -->

| Metric | Category | Source | Year | Unit | Coverage |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **National & State parks** (`national_parks`) | `outdoors` | [National Park Service & Utah State Parks](https://www.nps.gov/state/ut/index.htm) | 2025 | miles | 42/42 towns |
| **Ski resort access** (`ski_access`) | `outdoors` | [Ski Utah & OpenStreetMap Road Network](https://www.skiutah.com/resorts) | 2025 | minutes | 42/42 towns |
| **Hiking & biking trails** (`trails`) | `outdoors` | [OpenStreetMap Overpass API (highway=path|footway|cycleway, route=hiking)](https://overpass-api.de/) | 2025 | trails within 20km | 42/42 towns |
| **Public transit departures** (`transit`) | `transit` | [Utah Transit Authority (UTA) Open GTFS Data & Regional Transit Agencies](https://www.rideuta.com/Developer-Resources/Data-Feeds) | 2025 | weekly departures per 1k residents | 42/42 towns |

<!-- sources:end -->

---

## 🎯 Supported Personas

Utah Fit includes preset personas to quickly explore the state's diversity:

1. **The Powder Chaser / Skier**: Maximum weight on ski access (`ski_access`) and proximity to mountain canyons (Park City, Cottonwood Heights, Sandy, Midway).
2. **The Young Family**: High weight on safety, cost of living, community amenities, and parks.
3. **The Remote Tech Worker**: Balances transit access, outdoor recreation, dining, and housing value along the Silicon Slopes corridor (Lehi, Draper, Sandy, Salt Lake City).
4. **The Outdoor Explorer**: Prioritizes trail density (`trails`), National Parks (`national_parks`), and BLM public land access (Moab, Springdale, Hurricane, Cedar City).
5. **The Retiree / Quiet Living**: Prioritizes low noise, clean air, scenic vistas, and healthcare access.

See [DEMO.md](./DEMO.md) for a structured 2-minute demonstration walkthrough.
