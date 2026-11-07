// Deterministic fictional ad data for the demo. Every business is invented; example.com URLs only.
// Same seed in, same rows out. Only `now` shifts the dates.

export type SampleAd = {
  kind: "pin" | "featured" | "job";
  title: string;
  body: string;
  url: string;
  lat: number;
  lng: number;
  cityId: string;
  startsAt: number;
  endsAt: number;
  status: "active";
  impressions: number;
  clicks: number;
  isSample: true;
};

const DAY = 24 * 3600 * 1000;

// [cityId, lat, lng, jitter degrees, pin categories, featured categories, job roles]
const TOWNS: [string, number, number, number, string, string, string][] = [
  ["salt-lake-city", 40.777, -111.921, 0.046, "cafe restaurant gym bike service", "apartments realtor", "nurse dev barista"],
  ["west-valley-city", 40.679, -112.009, 0.029, "restaurant mover contractor", "townhomes", "warehouse"],
  ["west-jordan", 40.603, -111.997, 0.022, "gym contractor cafe", "builder", "teacher"],
  ["provo", 40.257, -111.639, 0.043, "cafe restaurant bike gym", "apartments", "dev teacher barista"],
  ["orem", 40.295, -111.694, 0.023, "restaurant service", "realtor", "dev"],
  ["sandy", 40.573, -111.849, 0.027, "gym ski cafe", "townhomes", "nurse"],
  ["st-george", 37.105, -113.563, 0.063, "outfitter bike restaurant contractor", "builder realtor", "nurse"],
  ["ogden", 41.223, -111.973, 0.038, "ski outfitter cafe bike", "apartments", "mechanic"],
  ["layton", 41.077, -111.969, 0.024, "restaurant gym", "townhomes", "admin"],
  ["south-jordan", 40.551, -111.995, 0.019, "service gym", "builder", "dev"],
  ["lehi", 40.414, -111.880, 0.035, "cafe restaurant gym service", "apartments builder", "dev dev admin"],
  ["millcreek", 40.687, -111.849, 0.017, "cafe restaurant", "", "barista"],
  ["taylorsville", 40.658, -111.950, 0.017, "mover contractor", "", "driver"],
  ["herriman", 40.490, -112.013, 0.028, "gym service", "builder", "teacher"],
  ["logan", 41.736, -111.841, 0.037, "bike outfitter cafe ski", "apartments", "teacher"],
  ["murray", 40.655, -111.883, 0.017, "restaurant contractor", "", ""],
  ["draper", 40.498, -111.853, 0.028, "bike gym cafe", "realtor", "dev"],
  ["bountiful", 40.872, -111.859, 0.023, "cafe service", "", ""],
  ["riverton", 40.517, -111.969, 0.014, "gym", "", ""],
  ["spanish-fork", 40.122, -111.637, 0.035, "restaurant contractor", "builder", "warehouse"],
  ["roy", 41.179, -112.051, 0.016, "mover service", "", "mechanic"],
  ["pleasant-grove", 40.379, -111.735, 0.021, "cafe gym", "", ""],
  ["cedar-city", 37.683, -113.105, 0.039, "outfitter restaurant cafe", "realtor", "hospitality"],
  ["kaysville", 41.027, -111.947, 0.020, "cafe", "", ""],
  ["cottonwood-heights", 40.607, -111.821, 0.019, "ski gym", "", "ski"],
  ["holladay", 40.659, -111.820, 0.017, "cafe restaurant", "realtor", "barista"],
  ["eagle-mountain", 40.314, -112.038, 0.049, "service contractor", "builder townhomes", "warehouse"],
  ["saratoga-springs", 40.339, -111.917, 0.047, "gym restaurant", "builder", "solar"],
  ["american-fork", 40.376, -111.800, 0.022, "restaurant bike", "", "dev"],
  ["park-city", 40.651, -111.497, 0.031, "ski ski cafe restaurant outfitter", "apartments realtor", "ski hospitality barista"],
  ["heber-city", 40.533, -111.382, 0.037, "outfitter contractor cafe", "builder", "ski"],
  ["midway", 40.519, -111.476, 0.019, "restaurant", "", ""],
  ["moab", 38.570, -109.547, 0.020, "outfitter outfitter bike restaurant cafe", "realtor", "guide hospitality barista"],
  ["vernal", 40.452, -109.537, 0.013, "outfitter mover", "", "mechanic"],
  ["price", 39.601, -110.806, 0.013, "restaurant contractor", "", ""],
  ["tooele", 40.536, -112.302, 0.034, "service mover", "townhomes", "warehouse"],
  ["brigham-city", 41.519, -112.045, 0.032, "cafe", "", ""],
  ["richfield", 38.757, -112.092, 0.022, "restaurant contractor", "", ""],
  ["kanab", 37.031, -112.529, 0.018, "outfitter restaurant", "", "guide"],
  ["hurricane", 37.143, -113.352, 0.043, "bike service", "builder", "solar"],
  ["washington", 37.096, -113.479, 0.057, "gym restaurant contractor", "builder realtor", "nurse"],
  ["ephraim", 39.361, -111.583, 0.014, "cafe", "", ""],
];

const WORDS = [
  "Juniper", "Red Rock", "Sagebrush", "Cottonwood", "Aspen Ridge", "High Desert", "Copper Canyon", "Bluebird",
  "Wild Sage", "Granite Peak", "Pinyon", "Switchback", "Salt Flat", "Cedar Mesa", "Bristlecone", "Dry Creek",
  "Lone Pine", "Canyon Rim", "Quartz Hollow", "Alder Gulch", "Timberline", "Slate Fork", "Sunbeam", "Prairie Dog",
  "Beehive", "Mule Deer", "Pika", "Marmot", "Horned Lizard", "Kestrel", "Saltgrass", "Tumbleweed", "Gambel Oak",
  "Rimrock", "Ironwood", "Windriver", "Coyote Bench", "Sundial", "Larkspur", "Cinder Hill",
];

type Cat = { nouns: string[]; blurbs: string[] };
const PIN: Record<string, Cat> = {
  cafe: { nouns: ["Coffee Co.", "Roasters", "Bakehouse", "Cafe"], blurbs: ["Small-batch espresso and fresh pastries baked every morning in {town}.", "Slow mornings, strong coffee and a patio the locals fight over in {town}."] },
  restaurant: { nouns: ["Kitchen", "Grill", "Taproom", "Smokehouse"], blurbs: ["Family recipes and a seasonal menu, a {town} dinner favorite.", "Hearty plates, local beer and a patio open late in {town}."] },
  gym: { nouns: ["Fitness", "Strength Club", "Climbing Gym", "Yoga Loft"], blurbs: ["Day passes for newcomers and a free first class in {town}.", "Open 5am to 10pm with coaches who actually learn your name."] },
  outfitter: { nouns: ["Outfitters", "Guide Service", "Gear Exchange", "Adventure Co."], blurbs: ["Rentals, shuttles and guided day trips from {town}.", "Gear up for the trails, canyons and rivers near {town}."] },
  ski: { nouns: ["Ski & Board", "Snow Shop", "Ski Tune Lab", "Powder Rentals"], blurbs: ["Season rentals, same-day tunes and boot fitting near {town}.", "Demo this year's skis before you buy. Locals get a season discount."] },
  bike: { nouns: ["Cycle Works", "Bike Shop", "Trail Bikes", "Wheelhouse"], blurbs: ["Mountain and road bikes, rentals and fast repairs in {town}.", "Trail maps, tune-ups and a Thursday group ride out of {town}."] },
  contractor: { nouns: ["Builders", "Remodeling", "Roofing & Siding", "Home Repair"], blurbs: ["Kitchens, basements and decks done on schedule in {town}.", "Licensed and insured. Free estimates for {town} homeowners."] },
  mover: { nouns: ["Movers", "Moving & Storage", "Haul Crew"], blurbs: ["Flat-rate local moves in {town}. Careful crews, no surprise fees.", "Moving to or from {town}? Packing help and short-term storage included."] },
  service: { nouns: ["Cleaning Co.", "Plumbing", "Landscaping", "Pet Care"], blurbs: ["Reliable same-week service for {town} households.", "Book online, get a text when we are on the way. Serving {town}."] },
};
const FEATURED: Record<string, Cat> = {
  apartments: { nouns: ["Flats", "Apartments", "Lofts"], blurbs: ["New one- and two-bedroom apartments near downtown {town}. Ask about move-in specials.", "Pet-friendly apartment homes with a gym, courtyard and mountain views in {town}."] },
  townhomes: { nouns: ["Townhomes", "Row Homes", "Commons"], blurbs: ["Three-bedroom townhomes with garages, close to schools and trails in {town}.", "Low-maintenance living with a private patio in {town}."] },
  builder: { nouns: ["Homes", "Custom Homes", "Communities"], blurbs: ["New single-family homes with flexible floor plans now selling in {town}.", "Build on a quarter-acre lot in {town}. Model home open weekends."] },
  realtor: { nouns: ["Realty Group", "Home Team", "Property Advisors"], blurbs: ["Local agents who know every {town} neighborhood. Free relocation guide.", "Buying or selling in {town}? Talk to a neighbor who does this all week."] },
};
type Role = { title: string; lo: number; hi: number; unit: "hr" | "yr"; employers: string[]; blurb: string };
const JOB: Record<string, Role> = {
  dev: { title: "Software Engineer", lo: 95, hi: 140, unit: "yr", employers: ["Labs", "Systems", "Software"], blurb: "Hybrid role on a small product team. Equity and 401k match." },
  nurse: { title: "Registered Nurse", lo: 34, hi: 46, unit: "hr", employers: ["Health", "Care Center", "Clinic"], blurb: "Three 12-hour shifts a week, sign-on bonus and tuition help." },
  teacher: { title: "Elementary Teacher", lo: 48, hi: 64, unit: "yr", employers: ["Learning Academy", "Charter School", "Montessori"], blurb: "Full-time, benefits included. Start in August." },
  barista: { title: "Barista", lo: 15, hi: 19, unit: "hr", employers: ["Coffee Co.", "Roasters", "Cafe"], blurb: "Part-time mornings, tips shared, free drinks on shift." },
  warehouse: { title: "Warehouse Associate", lo: 18, hi: 24, unit: "hr", employers: ["Logistics", "Distribution", "Supply Co."], blurb: "Day and swing shifts, weekly pay and overtime available." },
  driver: { title: "Delivery Driver", lo: 20, hi: 27, unit: "hr", employers: ["Freight", "Courier", "Delivery"], blurb: "Local routes, home every night, clean driving record." },
  mechanic: { title: "Diesel Mechanic", lo: 28, hi: 40, unit: "hr", employers: ["Fleet Service", "Truck Repair", "Equipment"], blurb: "Tools stipend and paid certifications." },
  solar: { title: "Solar Installer", lo: 22, hi: 33, unit: "hr", employers: ["Solar", "Energy", "Power"], blurb: "Roof and ground installs, training provided, crew lead track." },
  hospitality: { title: "Front Desk Lead", lo: 17, hi: 23, unit: "hr", employers: ["Lodge", "Inn", "Suites"], blurb: "Seasonal or year-round, staff housing available." },
  ski: { title: "Lift Operator", lo: 16, hi: 21, unit: "hr", employers: ["Mountain Resort", "Ski Patrol Co.", "Snow Operations"], blurb: "Winter season, free ski pass and gear discounts." },
  guide: { title: "Outdoor Guide", lo: 20, hi: 32, unit: "hr", employers: ["Expeditions", "Guide Service", "Adventures"], blurb: "Seasonal, tips on top, wilderness first aid preferred." },
  retail: { title: "Retail Associate", lo: 15, hi: 20, unit: "hr", employers: ["Mercantile", "Goods", "Supply"], blurb: "Flexible hours, 20 percent staff discount." },
  admin: { title: "Office Administrator", lo: 21, hi: 29, unit: "hr", employers: ["Partners", "Group", "Services"], blurb: "Weekday office role with health benefits." },
};

/** mulberry32: tiny seeded PRNG so reruns produce identical rows. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const money = (n: number, unit: "hr" | "yr") => (unit === "yr" ? `$${n}k` : `$${n}`);

// Mean CTR per kind, scaled by a 0.5x to 2x spread so the dashboard shows winners and duds.
const CTR: Record<SampleAd["kind"], number> = { pin: 0.026, featured: 0.019, job: 0.034 };
const REACH: Record<SampleAd["kind"], number> = { pin: 1, featured: 1.8, job: 0.9 };

export function buildSampleAds(now: number): SampleAd[] {
  const rand = rng(88);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const usedNames = new Set<string>();
  const ads: SampleAd[] = [];

  const uniqueName = (nouns: string[]) => {
    for (let i = 0; i < 200; i++) {
      const name = `${pick(WORDS)} ${pick(nouns)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    throw new Error("sample name pool exhausted");
  };

  const push = (kind: SampleAd["kind"], town: (typeof TOWNS)[number], title: string, body: string) => {
    const [cityId, lat, lng, r] = town;
    const daysLive = 3 + Math.floor(rand() * 28);
    const dailyReach = (40 + rand() * 260) * REACH[kind];
    const impressions = Math.round(dailyReach * daysLive);
    const ctr = Math.min(0.09, Math.max(0.004, CTR[kind] * (0.5 + rand() * 1.5)));
    ads.push({
      kind,
      title,
      body,
      url: `https://example.com/sample/${cityId}/${slug(title)}`,
      lat: +(lat + (rand() - 0.5) * 2 * r).toFixed(5),
      lng: +(lng + (rand() - 0.5) * 2 * r * 1.2).toFixed(5),
      cityId,
      startsAt: now - daysLive * DAY,
      endsAt: now + (60 + Math.floor(rand() * 120)) * DAY,
      status: "active",
      impressions,
      clicks: Math.round(impressions * ctr),
      isSample: true,
    });
  };

  for (const town of TOWNS) {
    const name = town[0].split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const [, , , , pins, featured, jobs] = town;
    for (const key of pins.split(" ").filter(Boolean)) {
      const cat = PIN[key];
      push("pin", town, uniqueName(cat.nouns), pick(cat.blurbs).replace("{town}", name));
    }
    for (const key of featured.split(" ").filter(Boolean)) {
      const cat = FEATURED[key];
      push("featured", town, uniqueName(cat.nouns), pick(cat.blurbs).replace("{town}", name));
    }
    for (const key of jobs.split(" ").filter(Boolean)) {
      const role = JOB[key];
      const lo = role.lo + Math.floor(rand() * 4);
      const pay = `${money(lo, role.unit)}-${money(lo + Math.round((role.hi - role.lo) / 2), role.unit)}/${role.unit}`;
      const employer = uniqueName(role.employers);
      push("job", town, `${role.title} at ${employer}`, `${role.title} in ${name}. Pay ${pay}. ${role.blurb}`);
    }
  }
  return ads;
}
