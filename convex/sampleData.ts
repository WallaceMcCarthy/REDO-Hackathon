import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { AdCategory } from "./lib/adCategories";
import type { Market } from "./lib/market";
import { buildListingAd, buildSampleAds, withListingAds, type SampleAd } from "./sampleAds";

const SAMPLE_DURATION_MS = 365 * 24 * 3600 * 1000;
const LISTING_ADS = 40;
// 3 in 10 ads are rentals, which lands on 28 homes and 12 rentals.
const isRentalTurn = (index: number) => [3, 6, 9].includes(index % 10);
// A row can lack an address or a location, so each town looks a little past its first candidate.
const LISTING_ROWS_PER_TOWN = 5;

type SampleCampaign = {
  kind: "pin" | "featured" | "job";
  category: AdCategory;
  cityId: string;
  title: string;
  body: string;
  url: string;
};

const sample = (kind: SampleCampaign["kind"], category: AdCategory, cityId: string, title: string, body: string): SampleCampaign => ({
  kind,
  category,
  cityId,
  title,
  body,
  url: `https://example.com/sample/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
});

/** Invented businesses on example.com. REDO is the one real name, agreed in CONTRACT.md. Copy makes no factual claims. */
export const SAMPLE_CAMPAIGNS: SampleCampaign[] = [
  {
    kind: "job",
    category: "tech_jobs",
    cityId: "salt-lake-city",
    title: "Apply to REDO!",
    body: "We are hiring engineers, product builders, and designers in Utah! Build software that moves mountains.",
    url: "https://getredo.com/careers",
  },
  sample("pin", "food", "salt-lake-city", "Snowplow Waffle Cart", "Sweet and savory waffles for the morning commute."),
  sample("pin", "services", "salt-lake-city", "Pigeonhole Moving Helpers", "Help with the heavy lifting when you land in a new apartment."),
  sample("pin", "food", "park-city", "Marmot and Mustard Deli", "Stacked sandwiches to carry up the canyon."),
  sample("pin", "outdoor", "park-city", "Pika Powder Ski Tuning", "Edges, wax, and bindings checked before the first storm."),
  sample("featured", "retail", "park-city", "Thistlewick Mountain Mercantile", "Wool layers, camp mugs, and small gifts for new neighbors."),
  sample("pin", "outdoor", "moab", "Redfin Lizard Bike Rentals", "Full-suspension rentals and trail maps for desert riding."),
  sample("pin", "food", "moab", "Saltbush Taco Window", "Quick tacos and cold drinks after a long day outside."),
  sample("pin", "food", "provo", "Lanternfish Noodle Counter", "Hand-pulled noodles and late hours for campus neighbors."),
  sample("job", "tech_jobs", "provo", "Quillfeather Data Works", "Hiring junior analysts for a pretend data team near campus."),
  sample("pin", "health", "provo", "Gentlemolar Family Dental", "New-patient cleanings for families settling into town."),
  sample("job", "tech_jobs", "lehi", "Bitterroot Byte Foundry", "Hiring backend engineers for an invented cloud tools startup."),
  sample("pin", "services", "lehi", "Wrenfield Home Inspections", "Walk through a house with an inspector before you sign."),
  sample("pin", "food", "ogden", "Cinderloaf Bakery", "Fresh rolls and fruit hand pies near the old rail yard."),
  sample("pin", "recreation", "ogden", "Gearjammer Climbing Barn", "Indoor bouldering for rainy days and beginners."),
  sample("pin", "outdoor", "st-george", "Sunscald Canyon Guides", "Half-day canyon walks for newcomers to the red rock."),
  sample("pin", "health", "st-george", "Quailbrush Physical Therapy", "Recovery plans for runners and weekend hikers."),
  sample("pin", "food", "logan", "Cachehollow Creamery Cart", "Small-batch ice cream on summer evenings."),
  sample("pin", "retail", "logan", "Inkmoth Paperback Nook", "Secondhand paperbacks and a quiet reading corner."),
  sample("pin", "outdoor", "heber-city", "Larkspur Float Outfitters", "Tube and paddleboard rentals for slow summer days."),
  sample("pin", "recreation", "cedar-city", "Grand Marmalade Players", "A pretend community theater looking for new faces."),
  sample("pin", "services", "cedar-city", "Juniperjack Pet Sitting", "Drop-in visits while you settle into a new job."),
  sample("pin", "outdoor", "kanab", "Vermilion Goat Trail Shuttle", "Point-to-point shuttles so you can hike one way."),
  sample("pin", "other", "vernal", "Fossilfern Community Print Shop", "Flyers and yard signs for local clubs and events."),
  sample("featured", "retail", "sandy", "Copperquail Furniture Barn", "Sturdy tables and shelves for a first Utah home."),
  sample("job", "services", "sandy", "Hollowbrook Snow Removal Crew", "Seasonal drivers wanted for invented neighborhood routes."),
];

/** One real listing per town, biggest towns first: the town's median price, so the ads read like the town and not its cheapest row. */
async function listingAds(ctx: MutationCtx, cities: Doc<"cities">[], now: number) {
  const statsFor = (market: Market) => ctx.db.query("marketListingStats").withIndex("by_market", (q) => q.eq("market", market)).take(100);
  const stats = { for_sale: await statsFor("for_sale"), for_rent: await statsFor("for_rent") };
  const ads: SampleAd[] = [];
  for (const city of [...cities].sort((a, b) => b.population - a.population || a.id.localeCompare(b.id))) {
    if (ads.length === LISTING_ADS) break;
    const markets: Market[] = isRentalTurn(ads.length) ? ["for_rent", "for_sale"] : ["for_sale", "for_rent"];
    for (const market of markets) {
      const prices = stats[market].find((s) => s.cityId === city.id)?.prices ?? [];
      const rows = await ctx.db
        .query("marketListings")
        .withIndex("by_city_market_residential_price", (q) =>
          q.eq("cityId", city.id).eq("market", market).eq("residential", true).gte("price", prices[prices.length >> 1] ?? 1))
        .take(LISTING_ROWS_PER_TOWN);
      const ad = rows.map((row) => buildListingAd(row, city.name, ads.length % 2 ? "pin" : "featured", now)).find(Boolean);
      if (ad) {
        ads.push(ad);
        break;
      }
    }
  }
  return ads;
}

export const seedSampleContent = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Reruns delete only isSample rows (campaigns, comments, profiles), then reinsert.
    for (const table of ["campaigns", "comments", "profiles"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        if (row.isSample) await ctx.db.delete(row._id);
      }
    }

    // Sample ads carry no advertiserUserId, so they sit in nobody's dashboard.
    // Generated rows go in first: the statewide read takes the newest rows, and those should be the hand-written ones.
    // Listing ads follow them, so the statewide read reaches them before invented businesses.
    const cities = await ctx.db.query("cities").collect();
    const generated = withListingAds(buildSampleAds(now), await listingAds(ctx, cities, now));
    for (const ad of generated) await ctx.db.insert("campaigns", ad);
    for (const camp of SAMPLE_CAMPAIGNS) {
      const city = cities.find((c) => c.id === camp.cityId);
      if (!city) throw new ConvexError(`Seed cities first: no town ${camp.cityId}`);
      await ctx.db.insert("campaigns", {
        ...camp,
        imageUrl: `/sample-ads/${camp.category}.svg`,
        lat: city.lat,
        lng: city.lng,
        startsAt: now,
        endsAt: now + SAMPLE_DURATION_MS,
        status: "active",
        impressions: 0,
        clicks: 0,
        isSample: true,
      });
    }

    // 4. Seed Sample Town Comments (with 1-level nested replies)
    const sampleComments = [
      {
        targetType: "town",
        targetId: "salt-lake-city",
        displayName: "Taylor Reed (Sample)",
        body: "The TRAX light rail connection directly from downtown to the airport and universities makes commuting so convenient without needing a car every day.",
        parentId: null,
        reports: 0,
        hidden: false,
        isSample: true,
        createdAt: now - 3600 * 1000 * 24 * 3,
        reply: {
          displayName: "Samira Patel (Sample)",
          body: "Totally agree! Especially during winter snow days, TRAX and the ski bus routes are lifesavers.",
        },
      },
      {
        targetType: "town",
        targetId: "moab",
        displayName: "Casey Morgan (Sample)",
        body: "Unbeatable access to Arches and Canyonlands. Just make sure you prepare for summer heat and high tourist seasons!",
        parentId: null,
        reports: 0,
        hidden: false,
        isSample: true,
        createdAt: now - 3600 * 1000 * 24 * 5,
        reply: {
          displayName: "Alex Rivera (Sample)",
          body: "Spring and late fall are prime weather here. Best desert stargazing in the country.",
        },
      },
      {
        targetType: "town",
        targetId: "park-city",
        displayName: "Jordan Lee (Sample)",
        body: "World-class ski resorts and incredible trail systems right outside your door. High housing costs, but the outdoor culture is vibrant.",
        parentId: null,
        reports: 0,
        hidden: false,
        isSample: true,
        createdAt: now - 3600 * 1000 * 24 * 2,
        reply: null,
      },
      {
        targetType: "town",
        targetId: "provo",
        displayName: "Devon Chen (Sample)",
        body: "Great community feel near Utah Lake and Rock Canyon. Tech jobs along the Silicon Slopes corridor are expanding rapidly.",
        parentId: null,
        reports: 0,
        hidden: false,
        isSample: true,
        createdAt: now - 3600 * 1000 * 24 * 4,
        reply: null,
      },
    ];

    // Comment names come from profiles, and a profile is one per user, so each author gets a fictional user plus a sample profile.
    const authorIds = new Map<string, Id<"users">>();
    const ensureAuthor = async (displayName: string) => {
      const known = authorIds.get(displayName);
      if (known) return known;
      const email = `sample-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.com`;
      const existing = await ctx.db.query("users").filter((q) => q.eq(q.field("email"), email)).first();
      const userId = existing?._id ?? (await ctx.db.insert("users", { name: displayName, email }));
      await ctx.db.insert("profiles", { userId, displayName, cityId: null, moveBy: null, budget: null, household: null, isSample: true });
      authorIds.set(displayName, userId);
      return userId;
    };

    for (const c of sampleComments) {
      const rootId = await ctx.db.insert("comments", {
        targetType: "town",
        targetId: c.targetId,
        userId: await ensureAuthor(c.displayName),
        body: c.body,
        parentId: null,
        reports: 0,
        hidden: false,
        isSample: true,
      });
      if (c.reply) {
        await ctx.db.insert("comments", {
          targetType: "town",
          targetId: c.targetId,
          userId: await ensureAuthor(c.reply.displayName),
          body: c.reply.body,
          parentId: rootId,
          reports: 0,
          hidden: false,
          isSample: true,
        });
      }
    }

    return {
      status: "success",
      sampleCampaignsCount: SAMPLE_CAMPAIGNS.length + generated.length,
      sampleCommentsCount: sampleComments.length,
    };
  },
});
