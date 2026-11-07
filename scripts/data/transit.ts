import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { writeMethodology } from "./lib.ts";

/**
 * Metric: transit
 * Weekly scheduled public transit departures per 1,000 residents, computed from
 * Utah Transit Authority (UTA)'s real published GTFS feed.
 *
 * Source URL for the feed itself: https://gtfsfeed.rideuta.com/GTFS.zip
 * (found via the MobilityData GTFS catalog, since UTA's old documented URL
 *  https://www.rideuta.com/-/media/Files/GTFS/google_transit.zip now 404s and
 *  https://www.rideuta.com/Developer-Resources/Data-Feeds no longer lists a feed link;
 *  https://database.mobilitydata.org tracks UTA's current feed as source id 170/2349,
 *  both pointing at https://gtfsfeed.rideuta.com/GTFS.zip).
 *
 * Method: for each town, sum scheduled weekly departures (stop_times rows) at every
 * GTFS stop within RADIUS_KM of the town's lat/lng centroid (data/cities.json), for a
 * representative Mon-Sun week in the feed's active range, then divide by the town's
 * population and multiply by 1000. Towns with zero UTA stops within the radius are
 * outside UTA's service area and get 0 (UTA does not serve rural southern/eastern Utah;
 * those towns have their own regional systems, e.g. SunTran in St. George,
 * which are out of scope here and are not silently guessed at).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GTFS_URL = "https://gtfsfeed.rideuta.com/GTFS.zip";
const GTFS_DIR = path.join(ROOT, "data", "raw", "gtfs");
const ZIP_PATH = path.join(GTFS_DIR, "GTFS.zip");
const EXTRACT_DIR = path.join(GTFS_DIR, "extracted");
const RADIUS_KM = 3;
// A representative, non-holiday Mon-Sun week inside the feed's active service period.
const WEEK_DATES = ["20260914", "20260915", "20260916", "20260917", "20260918", "20260919", "20260920"];

type Town = { id: string; name: string; county: string; lat: number; lng: number; population: number };

function loadTowns(): Town[] {
  const citiesPath = path.join(ROOT, "data", "cities.json");
  const cities = JSON.parse(fs.readFileSync(citiesPath, "utf-8"));
  return cities.map((c: any) => ({
    id: c.id,
    name: c.name,
    county: c.county,
    lat: c.lat,
    lng: c.lng,
    population: c.population,
  }));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function downloadGtfs(): Promise<void> {
  fs.mkdirSync(GTFS_DIR, { recursive: true });
  if (fs.existsSync(ZIP_PATH) && fs.statSync(ZIP_PATH).size > 1_000_000) {
    console.log(`Using cached GTFS zip at ${ZIP_PATH}`);
  } else {
    console.log(`Downloading UTA GTFS feed from ${GTFS_URL} ...`);
    const res = await fetch(GTFS_URL, {
      headers: { "User-Agent": "utahfit-hackathon/1.0 (data pipeline; contact: hackathon@example.com)" },
    });
    if (!res.ok) {
      throw new Error(`Failed to download GTFS feed: HTTP ${res.status} from ${GTFS_URL}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(ZIP_PATH, buf);
    console.log(`Saved ${buf.length} bytes to ${ZIP_PATH}`);
  }

  const neededFiles = ["stops.txt", "stop_times.txt", "trips.txt", "routes.txt", "calendar.txt", "calendar_dates.txt"];
  const alreadyExtracted = neededFiles.every((f) => fs.existsSync(path.join(EXTRACT_DIR, f)));
  if (alreadyExtracted) {
    console.log(`Using cached extracted GTFS at ${EXTRACT_DIR}`);
    return;
  }
  console.log(`Extracting GTFS zip to ${EXTRACT_DIR} ...`);
  // Use Node's zlib-backed unzip via the `AdmZip`-free manual approach: Node has no
  // built-in zip reader, so shell out to python3's zipfile module (stdlib, no deps)
  // in isolated mode since the archive is untrusted downloaded content.
  const { execFileSync } = await import("node:child_process");
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  execFileSync(
    "python3",
    [
      "-I",
      "-c",
      "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      ZIP_PATH,
      EXTRACT_DIR,
    ],
    { stdio: "inherit" }
  );
  for (const f of neededFiles) {
    if (!fs.existsSync(path.join(EXTRACT_DIR, f))) {
      throw new Error(`Expected GTFS file ${f} missing after extraction`);
    }
  }
}

function parseCsv(filePath: string): { header: string[]; rows: string[][] } {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(","));
  return { header, rows };
}

function col(header: string[], name: string): number {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Column ${name} not found in header: ${header.join(",")}`);
  return i;
}

async function main() {
  await downloadGtfs();
  const towns = loadTowns();

  console.log("Parsing GTFS tables ...");
  const stops = parseCsv(path.join(EXTRACT_DIR, "stops.txt"));
  const trips = parseCsv(path.join(EXTRACT_DIR, "trips.txt"));
  const calendar = parseCsv(path.join(EXTRACT_DIR, "calendar.txt"));
  const calendarDates = parseCsv(path.join(EXTRACT_DIR, "calendar_dates.txt"));

  // --- stop_id -> {lat, lon} ---
  const sId = col(stops.header, "stop_id");
  const sLat = col(stops.header, "stop_lat");
  const sLon = col(stops.header, "stop_lon");
  const stopLatLng = new Map<string, { lat: number; lng: number }>();
  for (const r of stops.rows) {
    const lat = Number(r[sLat]);
    const lng = Number(r[sLon]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      stopLatLng.set(r[sId], { lat, lng });
    }
  }

  // --- trip_id -> service_id ---
  const tTripId = col(trips.header, "trip_id");
  const tServiceId = col(trips.header, "service_id");
  const tripService = new Map<string, string>();
  for (const r of trips.rows) {
    tripService.set(r[tTripId], r[tServiceId]);
  }

  // --- calendar.txt: service_id -> weekday pattern + date range ---
  const cServiceId = col(calendar.header, "service_id");
  const cDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) =>
    col(calendar.header, d)
  );
  const cStart = col(calendar.header, "start_date");
  const cEnd = col(calendar.header, "end_date");
  type CalRow = { days: boolean[]; start: string; end: string };
  const baseCalendar = new Map<string, CalRow>();
  for (const r of calendar.rows) {
    baseCalendar.set(r[cServiceId], {
      days: cDays.map((i) => r[i] === "1"),
      start: r[cStart],
      end: r[cEnd],
    });
  }

  // --- calendar_dates.txt: (service_id, date) -> exception_type (1=added, 2=removed) ---
  const cdServiceId = col(calendarDates.header, "service_id");
  const cdDate = col(calendarDates.header, "date");
  const cdType = col(calendarDates.header, "exception_type");
  const exceptions = new Map<string, Map<string, number>>(); // service_id -> date -> type
  for (const r of calendarDates.rows) {
    const svc = r[cdServiceId];
    if (!exceptions.has(svc)) exceptions.set(svc, new Map());
    exceptions.get(svc)!.set(r[cdDate], Number(r[cdType]));
  }

  function isActive(serviceId: string, dateStr: string, weekdayIdx: number): boolean {
    let active = false;
    const base = baseCalendar.get(serviceId);
    if (base && dateStr >= base.start && dateStr <= base.end && base.days[weekdayIdx]) {
      active = true;
    }
    const ex = exceptions.get(serviceId)?.get(dateStr);
    if (ex === 1) active = true;
    if (ex === 2) active = false;
    return active;
  }

  // weekday index for each date in WEEK_DATES: Mon=0 ... Sun=6 (constructed to match that order)
  const allServiceIds = new Set<string>([...baseCalendar.keys(), ...exceptions.keys()]);
  const activeDayCount = new Map<string, number>();
  for (const svc of allServiceIds) {
    let count = 0;
    WEEK_DATES.forEach((d, idx) => {
      if (isActive(svc, d, idx)) count++;
    });
    activeDayCount.set(svc, count);
  }

  console.log(
    `Representative week ${WEEK_DATES[0]}-${WEEK_DATES[6]}: active-day counts per service -> ` +
      JSON.stringify(Object.fromEntries(activeDayCount))
  );

  // --- Stream stop_times.txt and accumulate weekly departures per stop_id ---
  console.log("Scanning stop_times.txt for weekly departures per stop (this file is ~23MB, one pass) ...");
  const stopTimesPath = path.join(EXTRACT_DIR, "stop_times.txt");
  const stRaw = fs.readFileSync(stopTimesPath, "utf-8");
  const stLines = stRaw.split(/\r?\n/);
  const stHeader = stLines[0].split(",").map((h) => h.trim());
  const stTripIdIdx = stHeader.indexOf("trip_id");
  const stStopIdIdx = stHeader.indexOf("stop_id");
  if (stTripIdIdx === -1 || stStopIdIdx === -1) {
    throw new Error("stop_times.txt missing trip_id/stop_id columns");
  }

  const weeklyDeparturesByStop = new Map<string, number>();
  let rowsProcessed = 0;
  let rowsSkippedUnknownTrip = 0;
  for (let i = 1; i < stLines.length; i++) {
    const line = stLines[i];
    if (!line) continue;
    const parts = line.split(",");
    const tripId = parts[stTripIdIdx];
    const stopId = parts[stStopIdIdx];
    const svc = tripService.get(tripId);
    if (!svc) {
      rowsSkippedUnknownTrip++;
      continue;
    }
    const days = activeDayCount.get(svc) ?? 0;
    if (days === 0) continue;
    weeklyDeparturesByStop.set(stopId, (weeklyDeparturesByStop.get(stopId) ?? 0) + days);
    rowsProcessed++;
  }
  console.log(`Processed ${rowsProcessed} stop_times rows (skipped ${rowsSkippedUnknownTrip} with unknown trip_id).`);

  // --- Per-town: sum weekly departures over stops within RADIUS_KM, normalize per 1k pop ---
  const values: Record<string, number> = {};
  const notes: string[] = [];
  for (const t of towns) {
    let sum = 0;
    let stopsInRange = 0;
    for (const [stopId, ll] of stopLatLng) {
      if (haversineKm(t.lat, t.lng, ll.lat, ll.lng) <= RADIUS_KM) {
        sum += weeklyDeparturesByStop.get(stopId) ?? 0;
        stopsInRange++;
      }
    }
    const perThousand = t.population > 0 ? (sum / t.population) * 1000 : 0;
    values[t.id] = Math.round(perThousand * 10) / 10;
    console.log(
      `${t.id}: ${stopsInRange} UTA stops within ${RADIUS_KM}km, ${sum} weekly departures, ` +
        `${values[t.id]} per 1k residents`
    );
    if (stopsInRange === 0) {
      notes.push(t.id);
    }
  }

  writeMethodology("transit", "UTA coverage only, not total public transit: Heber City has High Valley Transit route 106 (https://www.hvtutah.gov/bus-106-wasatch-back-connect-to-heber-valley), which is excluded from this UTA feed. A zero here does not mean no public transportation. Scheduled weekly (Mon-Sun) UTA transit departures per 1,000 residents, computed from UTA's real " +
  `published GTFS feed (${GTFS_URL}, feed_version 2026 AUG_20261008) by counting stop_times rows at every ` +
  `GTFS stop within ${RADIUS_KM}km of the town centroid, for the representative week of ` +
  `${WEEK_DATES[0]}-${WEEK_DATES[6]}, divided by town population and multiplied by 1000. Towns with 0 have no ` +
  "UTA stops within range, i.e. outside UTA's GTFS-covered service area: " +
  notes.sort().join(", ") +
  ". That includes rural southern/eastern Utah towns UTA does not serve at all (moab, vernal, price, " +
  "richfield, kanab, cedar-city, st-george, hurricane, washington, ephraim), some of which have separate " +
  "regional systems (e.g. SunTran in Cedar City/St. George) not covered by this feed, plus a few towns " +
  "just outside UTA's practical reach (park-city, heber-city, midway, logan, eagle-mountain, " +
  "saratoga-springs) where the nearest GTFS stop is well beyond this radius.");

  const metric = {
    id: "transit",
    label: "UTA transit departures",
    category: "transit",
    unit: "weekly departures per 1k residents",
    higherIsBetter: true,
    description:
      `Weekly UTA departures per 1,000 residents, counting stops within ${RADIUS_KM} km of the town center. UTA only, so a zero does not mean no public transit: regional systems such as High Valley Transit in Heber and SunTran in St. George are not included. Towns outside UTA's service area score zero.`,
    source: "Utah Transit Authority (UTA) GTFS feed",
    sourceUrl: GTFS_URL,
    year: 2026,
    values,
  };

  const outDir = path.join(ROOT, "data", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "transit.json");
  fs.writeFileSync(outPath, JSON.stringify(metric, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${outPath}`);
  console.log(`Towns with 0 (outside UTA service area): ${notes.sort().join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
