// Convex injects env vars into this runtime; @types/node isn't picked up by
// convex/tsconfig.json's isolated typecheck, so declare just what's needed.
declare const process: { env: Record<string, string | undefined> };

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
