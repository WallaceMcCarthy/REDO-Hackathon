// Seed script for Phase 3 sample content (clearly labeled with isSample: true)
// Usage:
//   npm run seed:sample
//   npm run seed:sample --prod

import { execSync } from "node:child_process";

const isProd = process.argv.includes("--prod");
const target = isProd ? "production" : "development";

console.log(`Seeding Phase 3 sample content to ${target} Convex backend...`);

try {
  const cmd = isProd
    ? "npx convex run sampleData:seedSampleContent --prod"
    : "npx convex run sampleData:seedSampleContent";
  const output = execSync(cmd, { stdio: "inherit" });
  console.log("Sample content successfully seeded!");
} catch (err: any) {
  console.error("Failed to seed sample content:", err?.message || err);
  process.exit(1);
}
