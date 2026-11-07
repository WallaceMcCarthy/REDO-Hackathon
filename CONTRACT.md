# Utah Fit: shared contract

A web app that ranks Utah towns for someone moving to Utah. People weight what they care about, such as air, outdoors, transit, culture, cost and safety. The app returns ranked towns, explains each score, and shows the towns on a map.

**Goal: a polished live demo, fast.** Anything not on the demo path gets cut.

## Stack

- Vite, React and TypeScript, with Tailwind and react-leaflet for the map.
- Convex for the database and the TypeScript backend.
- Data scripts in TypeScript, run with `npx tsx`.

## Layout (each area has one owner, so no file conflicts)

```
convex/schema.ts, convex/*.ts   backend: tables, seed mutation, queries       (backend)
convex/lib/scoring.ts           pure scoring function, no Convex imports       (search)
data/cities.json                canonical town list, ids below                 (data: core)
data/metrics/<metric>.json      one file per metric                            (data: owner of that metric)
scripts/data/<metric>.ts        script that produced that metric file          (data)
scripts/seed.ts                 loads data/ into Convex                        (backend)
src/                            React app                                      (frontend)
```

## Town ids (fixed: everyone uses exactly these)

salt-lake-city, west-valley-city, west-jordan, provo, orem, sandy, st-george, ogden, layton, south-jordan, lehi, millcreek, taylorsville, herriman, logan, murray, draper, bountiful, riverton, spanish-fork, roy, pleasant-grove, cedar-city, kaysville, cottonwood-heights, holladay, eagle-mountain, saratoga-springs, american-fork, park-city, heber-city, midway, moab, vernal, price, tooele, brigham-city, richfield, kanab, hurricane, washington, ephraim

`data/cities.json`:
```json
[{ "id": "provo", "name": "Provo", "county": "Utah", "lat": 40.2338, "lng": -111.6585, "population": 115162, "blurb": "One sentence about the town." }]
```

## Metric file format: `data/metrics/<metric>.json`

```json
{
  "id": "air_quality",
  "label": "Air quality",
  "category": "environment",
  "unit": "µg/m³ PM2.5 (annual mean)",
  "higherIsBetter": false,
  "description": "What it measures, one sentence.",
  "source": "EPA Air Quality System",
  "sourceUrl": "https://...",
  "year": 2025,
  "values": { "provo": 7.1, "salt-lake-city": 8.4 }
}
```

- `category` is one of `cost`, `safety`, `environment`, `outdoors`, `transit`, `culture`, `education`, `community`.
- Raw values in real units. The scoring code normalizes them, so don't pre-normalize.
- Every town should have a value. If a town has no measurement, use the nearest station or the county value, and say so in `description`.
- All data must be public and cited with a real `sourceUrl`. Never invent numbers.

## Scoring API: `convex/lib/scoring.ts`

```ts
export type Weights = Record<string /* metricId */, number /* 0..5 */>;
export type Filters = { maxHomeValue?: number; maxCommuteMinutes?: number };
export type TownScore = {
  cityId: string;
  score: number;                       // 0..100
  breakdown: { metricId: string; raw: number; normalized: number /* 0..1 */; weight: number; contribution: number }[];
  highlights: string[];                // e.g. "Top 3 for ski access"
};
export function rankTowns(cities, metrics, weights: Weights, filters: Filters): TownScore[];
```

The Convex query `api.search.rank({ weights, filters })` wraps `rankTowns`. Further queries are `api.cities.list`, `api.cities.get({ id })` and `api.metrics.list`.

## Frontend screens

1. **Landing / quiz.** Pick a few personas (skier, family, remote worker, foodie) or adjust a slider per category.
2. **Results.** A map with ranked pins on one side and ranked cards with score bars on the other. Results update live as the sliders move.
3. **Town detail.** Every metric compared with the Utah median, with source links.

---

# Phase 2: individual homes, apartments and map layers

Goal: the app suggests real homes and apartments inside the towns that fit you, not just towns. It also shows any metric as a heatmap, so the data behind each score can be seen on the map.

## Listing data (public sources only, real records, nothing invented)

There is no free, legal feed of for-sale MLS or Zillow listings, so we use public records and label them honestly in the UI:

- **Homes:** real residential parcels from the Utah Geospatial Resource Center (UGRC) statewide parcels with LIR attributes (county assessor data). Fields: market value, building sqft, year built, property class. The UI says "Estimated value (county assessor, <year>)", never "price".
- **Apartments:**
  - Real apartment complexes from the HUD LIHTC database and the HUD Multifamily properties datasets, plus OpenStreetMap `building=apartments` with a `name`.
  - Estimated rent comes from HUD Small Area Fair Market Rents (SAFMR) for the complex's ZIP code, labeled "HUD fair market rent for this ZIP".

`data/listings/homes.json` and `data/listings/apartments.json`, each an array of:
```json
{
  "id": "slco-16053260150000",
  "cityId": "salt-lake-city",
  "kind": "home",
  "name": null,
  "address": "123 E Example Ave",
  "lat": 40.75, "lng": -111.88,
  "value": 525000,
  "rent": null,
  "beds": null, "sqft": 1840, "yearBuilt": 1948, "units": null,
  "propertyType": "Single family",
  "source": "UGRC Salt Lake County LIR parcels 2025",
  "sourceUrl": "https://..."
}
```

- `kind` is "home" or "apartment".
- A home has `value`. An apartment has `rent` (monthly, 2-bedroom SAFMR) and `units` where known.
- Fields a source doesn't have are `null`.
- **Volume:** `data/listings/homes.json` is a git-tracked sample (currently 80 homes per town, spread evenly, under 2 MB). It feeds the `listings` fallback. Apartments: up to 40 per town.
- **Homes live in the database.** At most 2,000 improved residential parcels per town (about 77,700 of the 590,634 available, 36 of 42 towns in full, the 6 largest sampled) go to the Convex `assessorListings` table, an even spatial spread that is the same on every run (`--max-per-town=N` overrides). Towns under the cap load in full. The cap keeps one dev plus one prod load under half of the Convex Free plan's 1 GB/month bandwidth; storage is estimated at about 60%, of 0.5 GB. No file in git. Raw pages and load progress stay in `data/raw/`, which is gitignored.
- **Size:** the 2 MB limit applies only to files browsers download (`public/data/`) and data tracked in git. It does not limit the database.

## Backend (Convex)

- **Schema:** `listings` table with the fields above, indexed by `cityId` and by `kind`.
- **Query `api.listings.forTown({cityId, kind?, maxValue?, maxRent?})`:** sorted by fit.
- **Query `api.listings.recommend({weights, filters, kind, limit})`:** takes the top towns from `rankTowns`, then the best listings inside them by budget fit and size. Returns the listing plus its town score and a one-line reason.
- **Table `assessorListings`:** one row per parcel, keyed by the same `county-PARCEL_ID` id as `listings` homes, indexed by id and by `[cityId, value, id]`. Never bulk-load parcels into `listings`: `forTown`, `recommend` and `search` collect that table.
- **Query `api.assessor.townHomes({cityId, maxValue?, paginationOpts})`:** one town, cheapest first, at most 100 rows per page. No query may scan this table. Convex stops a transaction at 32,000 documents scanned or 16 MiB read.
- **Parcel load:** `npm run seed:assessor` streams towns through the internal mutation `assessor.upsertListings` in chunks of at most 1,000 rows and 400 KB. It is idempotent by parcel id and resumes from `data/raw/assessor-load/`. george runs it.
- **Seeding:** the CLI arg limit is about 1 MB, so the seed script loads listings in chunks of about 500 through an internal mutation, `seed.replaceListings`. george runs the seeds.

## Map layers (frontend)

- **Layer picker:** one control on the results map shows any single metric as a heatmap.
- **Interpolation:** in the browser, using inverse-distance weighting (power 2) from the 42 town values onto a grid canvas over Utah, about 150x150 cells.
- **Display:**
  - Color follows `higherIsBetter`, so green always means better.
  - A legend shows real min and max with units.
  - A "Source" link uses the metric's `sourceUrl`.
  - The 42 measured points stay visible as dots, so it's clear what is measured and what is interpolated.
- **Listings:** show as pins once zoomed in on a town. Clicking one opens a card with its fields, the source and a "Why this home" line.

## Later, if time allows (in this order)

1. Sponsored pins and featured listings, the monetization story.
   - Clearly labeled "Sponsored (sample)" in the demo.
   - Include one "Apply to REDO" pin.
2. A video of the build process from the git history, board log and chat.
3. Cut for this hackathon: login, social features, roommates and comments.

---

# Phase 3: a working product (accounts, social, advertising, REDO payments)

Decision from our humans: the whole app must actually work, not just demo. That means real accounts, real social features, real self-serve advertising, and **REDO for all financial transactions**.

## Ground rules

- Auth uses **Convex Auth** with the Password provider (email + password), with no third-party OAuth setup. Every write checks `ctx.auth`, and no mutation trusts a client-sent user id.
- Payments go **only through REDO**:
  - REDO credentials live in Convex environment variables (`npx convex env set ...`), never in git or the frontend.
  - Payment confirmation arrives through a REDO webhook into a Convex HTTP action, with its signature verified. Only then does a paid feature turn on.
  - Use REDO's sandbox or test mode until our humans say go live.
- Demo content (sample users, comments, ads) must be clearly marked `isSample: true` and shown with a "Sample" badge, so nothing looks like a real person who doesn't exist.
- Moderation minimum: users can delete their own posts and comments, and anyone can report a comment or post. Reported items are hidden after 3 reports.

## Features, in build order

1. **Accounts:** sign up, sign in, sign out, plus a profile with display name, current city, move-by date, budget, and household size.
2. **Saved homes:** heart any home or apartment, with a "My saved places" page.
3. **Comments on listings and towns:** threaded one level deep, newest first. A comment needs an account.
4. **Roommate finder:**
   - An opt-in roommate profile: budget range, towns of interest, move-in date, lifestyle tags, short bio.
   - Matches are ranked by overlap of towns, budget and date.
   - "Request to connect" sends a request. Contact details are shared only after both sides accept.
5. **Town feed:** short posts per town, such as questions and tips, with likes and comments. It powers the social side of the town page.
6. **Advertising, self-serve and paid through REDO:**
   - An advertiser account creates a campaign: a sponsored map pin for a business ("Eat at Freddy's!"), a featured listing that is pinned to the top of "Places to live" and labeled "Sponsored", or a job listing pin ("Apply to REDO!").
   - Checkout runs through REDO.
   - The campaign is `pending_payment`, becomes `active` when the REDO webhook confirms, and ends at `expired` after its duration.
   - The map shows active sponsored pins with a "Sponsored" label. The featured slot is never mixed silently with organic ranking.
   - There is a basic advertiser dashboard: campaigns, status, impressions and clicks (counted server-side).
7. **Stretch:** a build-process video made from the git history, board log and chat.

## Data model (Convex)

| Table | Fields |
| --- | --- |
| `users` | from Convex Auth |
| `profiles` | userId, displayName, cityId, moveBy, budget, household, isSample |
| `saved` | userId, listingId |
| `comments` | targetType (listing/town/post), targetId, userId, body, parentId, reports, hidden, isSample |
| `roommateProfiles` | userId, budgetMin, budgetMax, cityIds, moveIn, tags, bio, active |
| `connections` | fromUserId, toUserId, status (pending/accepted/declined) |
| `posts` | cityId, userId, body, likes, isSample |
| `campaigns` | advertiserUserId, kind (pin/featured/job), title, body, url, lat, lng, listingId, cityId, startsAt, endsAt, status, redoPaymentId, impressions, clicks, isSample |
| `payments` | campaignId, redoPaymentId, amount, currency, status, raw webhook event id (for idempotency) |

## Blocked on humans

REDO API documentation and sandbox credentials. Which REDO product or API handles payments, and how do webhooks work? Until those arrive, the REDO client is written behind an interface, `convex/lib/payments.ts`, with a clearly labeled sandbox stub. Everything else ships first.
