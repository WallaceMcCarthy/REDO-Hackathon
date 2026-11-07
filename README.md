# 🏔️ Utah Fit

**Utah Fit** is an interactive, data-driven web app that helps people moving to Utah discover and rank 42 fixed Utah towns based on what matters most to them. 

Users customize their personal priorities—such as ski access, air quality, outdoor trails, transit frequency, cost of living, safety, and community culture—to receive instant, personalized rankings, detailed metric breakdowns, and an interactive geographic map.

---

## ⚡ Quickstart / Local Development

Requires Node 20.19+ or 22.12+. On older versions the build fails with `Cannot find native binding`.

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
| **Air quality** (`air_quality`) | `environment` | [EPA Air Quality System (AQS) annual concentration by monitor](https://aqs.epa.gov/aqsweb/airdata/download_files.html#Annual) | 2025 | µg/m³ PM2.5 (annual mean) | 42/42 towns |
| **Average commute** (`commute_minutes`) | `transit` | [U.S. Census Bureau, 2020–2024 ACS 5-year estimates (B08013 / B08303)](https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/) | 2024 | minutes | 42/42 towns |
| **Crime rate** (`crime_rate`) | `safety` | [Utah BCI (DPS) Crime in Utah 2024 report, NIBRS Crimes Against Totals](https://bci.utah.gov/wp-content/uploads/2024-Crime-in-Utah-Report.pdf) | 2024 | NIBRS crimes against persons + property per 1,000 residents | 42/42 towns |
| **Median home value** (`home_value`) | `cost` | [U.S. Census Bureau, American Community Survey 5-Year Estimates (Table DP04)](https://data.census.gov/table/ACSDP5Y2023.DP04) | 2023 | USD | 42/42 towns |
| **Median household income** (`median_income`) | `cost` | [U.S. Census Bureau, American Community Survey 5-Year Estimates (Table S1901)](https://data.census.gov/table/ACSST5Y2023.S1901) | 2023 | USD/year | 42/42 towns |
| **Median gross rent** (`median_rent`) | `cost` | [U.S. Census Bureau, American Community Survey 5-Year Estimates (Table DP04)](https://data.census.gov/table/ACSDP5Y2023.DP04) | 2023 | USD/month | 42/42 towns |
| **National & State parks** (`national_parks`) | `outdoors` | [National Park Service & Utah State Parks coordinates, modeled road distances](https://www.nps.gov/state/ut/index.htm) | 2025 | miles | 42/42 towns |
| **Quiet (distance from highway/airport noise)** (`noise`) | `environment` | [OpenStreetMap contributors via Overpass API (derived distances)](https://www.openstreetmap.org/copyright) | 2026 | km to nearest interstate or airport | 42/42 towns |
| **Price-to-income ratio** (`price_to_income`) | `cost` | [Derived from this repo's home_value and median_income metrics (Census ACS 5-year estimates)](https://data.census.gov/table/ACSDP5Y2023.DP04) | 2023 | years of median household income | 42/42 towns |
| **Rent burden** (`rent_burden`) | `cost` | [Derived from this repo's median_rent and median_income metrics (Census ACS 5-year estimates)](https://data.census.gov/table/ACSDP5Y2023.DP04) | 2023 | share of median household income spent on median rent (annualized) | 42/42 towns |
| **Restaurants & cafes nearby** (`restaurants_per_1k`) | `culture` | [OpenStreetMap contributors via Overpass; canonical town population from ACS](https://overpass-api.de/api/interpreter) | 2026 | within 5 km per 1,000 town residents | 42/42 towns |
| **High school graduation rate** (`schools`) | `education` | [Utah State Board of Education (USBE) 2025 Graduation Report](https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf) | 2025 | % graduation rate | 42/42 towns |
| **Ski resort access** (`ski_access`) | `outdoors` | [Ski Utah resort coordinates & modeled road distances](https://www.skiutah.com/resorts) | 2025 | minutes | 42/42 towns |
| **Distance to pro/college sports** (`sports`) | `culture` | [Venue coordinates from Wikipedia](https://en.wikipedia.org/wiki/List_of_sports_venues_in_Utah) | 2025 | km to nearest pro or NCAA D1 venue | 42/42 towns |
| **Tech employers** (`tech_employers`) | `community` | [U.S. Census Bureau, 2023 ZIP Code Business Patterns (ZBP) & 2023 ZCTA Gazetteer](https://www.census.gov/programs-surveys/cbp/data/datasets.html) | 2023 | establishments within 25km | 42/42 towns |
| **Hiking & biking trails** (`trails`) | `outdoors` | [OpenStreetMap contributors, via the Overpass API](https://maps.mail.ru/osm/tools/overpass/api/interpreter) | 2026 | trails within 20km | 41/42 towns |
| **UTA transit departures** (`transit`) | `transit` | [Utah Transit Authority (UTA) GTFS feed](https://gtfsfeed.rideuta.com/GTFS.zip) | 2026 | weekly departures per 1k residents | 42/42 towns |
| **Distance to a university** (`university_access`) | `education` | [Institution list per NCES College Navigator; coordinates from Wikipedia](https://nces.ed.gov/collegenavigator/?s=UT&l=93&ct=2+3) | 2025 | km to nearest 4-year university/college | 42/42 towns |
| **Arts & culture venues nearby** (`venues`) | `culture` | [OpenStreetMap contributors via Overpass](https://overpass-api.de/api/interpreter) | 2026 | mapped venues within 15 km | 42/42 towns |
| **Drinking water quality** (`water_quality`) | `environment` | [EPA SDWIS via Envirofacts (data.epa.gov/efservice VIOLATION table)](https://www.epa.gov/enviro/sdwis-model) | 2026 | health-based violations, last 5 years | 42/42 towns |
| **Residential water use** (`water_usage`) | `environment` | [Utah Division of Water Resources, Municipal & Industrial Water Use 2022](https://dwre-utahdnr.opendata.arcgis.com/pages/municipal-and-industrial) | 2022 | gallons per capita per day (residential potable) | 42/42 towns |

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
