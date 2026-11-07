import { internalMutation } from "./_generated/server";
import { buildSampleAds } from "./sampleAds";

export const seedSampleContent = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const duration30Days = 30 * 24 * 3600 * 1000;

    // 1. Remove existing sample records to keep seed idempotent
    try {
      const existingCampaigns = (await (ctx.db.query as any)("campaigns").collect()) as any[];
      for (const c of existingCampaigns) {
        if (c.isSample) await (ctx.db.delete as any)(c._id);
      }
    } catch {}

    try {
      const existingComments = (await (ctx.db.query as any)("comments").collect()) as any[];
      for (const c of existingComments) {
        if (c.isSample) await (ctx.db.delete as any)(c._id);
      }
    } catch {}

    // 2. Create a fictional demo user ID for sample authors
    let demoUserId: any;
    try {
      const users = (await (ctx.db.query as any)("users").collect()) as any[];
      demoUserId = users[0]?._id;
      if (!demoUserId) {
        demoUserId = await (ctx.db.insert as any)("users", {
          name: "Sample Demo Persona",
          email: "demo-persona@example.com",
        });
      }
    } catch {
      demoUserId = "sample_user_demo";
    }

    // 3. Seed Sample Campaigns (Pins, Featured Slot, Job Opening)
    const sampleCampaigns = [
      {
        advertiserUserId: demoUserId,
        kind: "job",
        title: "Apply to REDO!",
        body: "We are hiring engineers, product builders, and designers in Utah! Build software that moves mountains.",
        url: "https://getredo.com/careers",
        lat: 40.7608,
        lng: -111.8910,
        cityId: "salt-lake-city",
        startsAt: now,
        endsAt: now + duration30Days,
        status: "active",
        impressions: 1420,
        clicks: 184,
        isSample: true,
      },
      {
        advertiserUserId: demoUserId,
        kind: "pin",
        title: "Freddy's Alpine Bakery",
        body: "Handcrafted artisan sourdough and single-origin espresso. Fuel up before heading up the canyon!",
        url: "https://example.com/freddys-alpine",
        lat: 40.6461,
        lng: -111.4980,
        cityId: "park-city",
        startsAt: now,
        endsAt: now + duration30Days,
        status: "active",
        impressions: 890,
        clicks: 76,
        isSample: true,
      },
      {
        advertiserUserId: demoUserId,
        kind: "featured",
        title: "Wasatch Crest Mountain Residence",
        body: "Ski-in/ski-out luxury living with panoramic mountain views and modern timber craftsmanship.",
        url: "https://example.com/featured-wasatch-crest",
        lat: 40.638,
        lng: -111.512,
        cityId: "park-city",
        startsAt: now,
        endsAt: now + duration30Days,
        status: "active",
        impressions: 2150,
        clicks: 198,
        isSample: true,
      },
      {
        advertiserUserId: demoUserId,
        kind: "pin",
        title: "Moab Slickrock Outfitters",
        body: "Full-suspension mountain bike rentals, desert gear, and guided trail expeditions.",
        url: "https://example.com/moab-slickrock",
        lat: 38.5733,
        lng: -109.5498,
        cityId: "moab",
        startsAt: now,
        endsAt: now + duration30Days,
        status: "active",
        impressions: 640,
        clicks: 53,
        isSample: true,
      },
    ];

    // Generated ads carry no advertiserUserId, so they never show up in a real account's dashboard.
    sampleCampaigns.push(...(buildSampleAds(now) as any[]));

    for (const camp of sampleCampaigns) {
      try {
        await (ctx.db.insert as any)("campaigns", camp);
      } catch (err) {
        console.warn("Could not insert sample campaign:", err);
      }
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

    // Comment names come from profiles (publicComment), and a profile is one per user,
    // so each sample author gets their own fictional user plus a sample profile.
    const authorIds = new Map<string, any>();
    const ensureAuthor = async (displayName: string) => {
      const known = authorIds.get(displayName);
      if (known) return known;
      const email = `sample-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.com`;
      const users = (await (ctx.db.query as any)("users").collect()) as any[];
      const userId = users.find((u) => u.email === email)?._id ?? (await (ctx.db.insert as any)("users", { name: displayName, email }));
      const profile = await (ctx.db.query as any)("profiles").withIndex("by_userId", (q: any) => q.eq("userId", userId)).first();
      const fields = { userId, displayName, cityId: null, moveBy: null, budget: null, household: null, isSample: true };
      if (profile) await (ctx.db.patch as any)(profile._id, fields);
      else await (ctx.db.insert as any)("profiles", fields);
      authorIds.set(displayName, userId);
      return userId;
    };

    for (const c of sampleComments) {
      const rootId = await (ctx.db.insert as any)("comments", {
        targetType: c.targetType,
        targetId: c.targetId,
        userId: await ensureAuthor(c.displayName),
        body: c.body,
        parentId: null,
        reports: c.reports,
        hidden: c.hidden,
        isSample: c.isSample,
      });

      if (c.reply) {
        await (ctx.db.insert as any)("comments", {
          targetType: c.targetType,
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
      sampleCampaignsCount: sampleCampaigns.length,
      sampleCommentsCount: sampleComments.length,
    };
  },
});
