# Utah Fit

Utah Fit helps people moving to Utah find where they fit. You set a budget and say what matters. It ranks homes and apartments across 42 Utah towns, shows them on a map, and traces every town's score to a public source. The live site is https://cmascope.com. For a presenter's script, see [DEMO.md](./DEMO.md).

## What the site does

The app has no router library. Every screen is a hash route, so `https://cmascope.com/#/results` is the results screen. `src/App.tsx` maps each route to a screen in `src/screens/`.

| Route | Screen | Needs an account |
| :--- | :--- | :---: |
| `#/` | Start page. Choose Buy or Rent, set a max price or rent, pick personas, and tune eight priority sliders. | No |
| `#/results` | Homes first. A ranked list of homes grouped by area, next to a map. Filters for max price, sort, priorities and max commute. | No |
| `#/results?view=apartments` | The same screen on apartment complexes, with HUD fair market rent. | No |
| `#/results?view=areas` | All 42 towns ranked, each with a "Why it fits" line. | No |
| `#/results?town=<id>` | Homes in one town. | No |
| `#/town/<id>` | A town page. Fit score, places to live, a feed, comments, and every metric against the Utah median with its source. | To post |
| `#/messages` | Direct messages between users. | Yes |
| `#/saved` | Saved homes and apartments. | Yes |
| `#/account` | Profile. | Yes |
| `#/roommates` | Roommate profile and matches. No link in the app leads here yet. | Yes |
| `#/advertise` | Self-serve ad campaigns. Checkout is a sandbox, and no payment is taken. | Yes |

A listing is a real public record. A home's "Est. value" is the county assessor's value, never an asking price. An apartment's rent is the HUD fair market rent for its ZIP code. On the map, a layer picker draws any one of the 21 metrics as a heat map.

## Run it locally

Node 20.19+ or 22.12+ is required. Older versions fail the build with `Cannot find native binding`.

```bash
npm ci
CONVEX_AGENT_MODE=anonymous npx convex dev   # local Convex backend, writes .env.local
npm run seed                                 # in a second terminal: towns, metrics, listings
npm run dev                                  # http://localhost:5173
```

`npm run seed` loads `data/cities.json`, `data/metrics/*.json` and `data/listings/*.json` into the deployment named in `.env.local`. `npm run seed:prod` targets production and needs the deploy owner's Convex login, so run it only when you own that deployment.

## Test

```bash
npm test                # vitest unit tests
npx tsc --noEmit        # type check
npm run build           # type check, then vite build
npm run test:e2e        # Playwright against a local build, desktop and 390px phone
npm run test:e2e:prod   # the same suite against https://cmascope.com
```

`npm run test:e2e` builds with `VITE_CONVEX_URL` pointing at the production Convex deployment. `e2e/signed-in.spec.ts` creates real accounts, so it skips unless `VITE_CONVEX_URL` is a local backend.

## Ship a change

Everything pushed to `main` goes live on https://cmascope.com in a few minutes. Keep unfinished work on a branch.

An auto-deployer decides what ships. It is not in this repository. It runs on a team member's Mac, watches `main` every 30 seconds, and is the only thing that deploys, because Vercel's Git auto-deploy is disconnected on purpose. For each new commit it does these things in order.

1. Type checks the commit.
2. Builds it and runs the Playwright smoke test on the build.
3. Checks the backend gate below.
4. Deploys, then runs the smoke test again on the live site.

It posts an `[autodeploy]` line to the team board with the result. A failed check leaves the live site unchanged and says why. The build stamp on the site shows the commit and time of what is live. Do not run `vercel --prod` by hand without saying so on the board.

### The backend gate

`convex/PROD_DEPLOYED` holds one line, the commit SHA that was last deployed to production Convex. A commit that changes anything under `convex/` does not ship until production Convex has it, because the new frontend would call functions that do not exist there. The gate releases in two steps.

1. The owner of the Convex production deployment deploys it from the commit.
2. They commit that SHA on one line in `convex/PROD_DEPLOYED` and push to `main`.

The history shows the pattern. Commits `0beadb8` and `adbe783` are named "Record Convex prod deploy of ..." and touch only that file. At the time of writing the file reads `4a84009ba6eac6be178e5155e2bab4b9efda2049`, and nothing else under `convex/` has changed since that commit.

The comparison itself runs in the deployer. No file in this repository reads `convex/PROD_DEPLOYED`.

### Pause deploys

Ask Bob, who runs the deployer, to set a HOLD. Nothing ships while the HOLD is set, and commits to `main` wait. This is a board convention. The repository has no switch for it.

## Architecture

- **Frontend.** Vite, React 18, TypeScript and Tailwind CSS. The map is MapLibre GL. Shared components live in `src/components/ui`, and `#/ui` shows every state.
- **Backend.** [Convex](https://www.convex.dev/) holds the data, the queries, and the account system (Convex Auth with email and password). The tables cover towns, metrics, listings, profiles, saved homes, comments, messages, roommate profiles, town posts, ad campaigns, and Zillow link previews.
- **Scoring.** `convex/lib/scoring.ts` is a pure function. It normalizes each metric across the 42 towns, applies your weights, and writes the "Why it fits" highlights. `api.search.rank` wraps it.
- **Data.** `scripts/data/*.ts` build `data/metrics/*.json` from public sources. `scripts/seed.ts` loads them into Convex. Metric files never hold invented numbers.

```
convex/
  schema.ts, *Schema.ts   tables
  search.ts, cities.ts, metrics.ts, listings.ts   public queries
  account.ts, social.ts, messages.ts, roommates.ts, ads.ts, zillowPreviews.ts   signed-in features
  lib/scoring.ts          pure scoring engine
  PROD_DEPLOYED           the backend gate
data/
  cities.json             the 42 towns
  metrics/<metric>.json   one file per metric, with source and year
  listings/               homes and apartments
scripts/
  seed.ts                 loads data/ into Convex
  sources-table.ts        regenerates the table below
  data/<metric>.ts        builds one metric file
src/
  App.tsx                 hash router
  screens/                one file per route
  components/             UI by area
e2e/                      Playwright specs
```

## Public data sources

Every metric cites a public dataset. To regenerate this table from `data/metrics/*.json`, run `npx tsx scripts/sources-table.ts`.

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

The persona presets on the start page are Skier, Family, Remote worker and Foodie. They stack, and each one sets the eight sliders.
