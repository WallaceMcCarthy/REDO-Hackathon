import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insideMunicipality, type ListingRecord, type Point } from "./listings_apartments";

const APARTMENTS_FILE = resolve(__dirname, "../../data/listings/apartments.json");
const MIGRATION_FILE = resolve(__dirname, "../../data/listings/apartments_id_migration.json");

describe("listings_apartments", () => {
  describe("insideMunicipality point-in-polygon", () => {
    // 10x10 square from (0,0) to (10,10)
    const square: Point[][] = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ];

    it("identifies interior points", () => {
      expect(insideMunicipality([5, 5], square)).toBe(true);
      expect(insideMunicipality([1, 1], square)).toBe(true);
      expect(insideMunicipality([9, 9], square)).toBe(true);
    });

    it("identifies exterior points", () => {
      expect(insideMunicipality([15, 5], square)).toBe(false);
      expect(insideMunicipality([-1, 5], square)).toBe(false);
      expect(insideMunicipality([5, 12], square)).toBe(false);
    });

    it("handles null / undefined coordinates safely", () => {
      expect(insideMunicipality([null as any, 5], square)).toBe(false);
      expect(insideMunicipality([5, undefined as any], square)).toBe(false);
    });
  });

  describe("data/listings/apartments.json integrity", () => {
    it("exists and is under the 2 MB budget", () => {
      expect(existsSync(APARTMENTS_FILE)).toBe(true);
      const bytes = statSync(APARTMENTS_FILE).size;
      expect(bytes).toBeLessThan(2_000_000);
      expect(bytes).toBeGreaterThan(100_000);
    });

    it("contains valid apartment listings with stable source-derived IDs", () => {
      const raw = readFileSync(APARTMENTS_FILE, "utf-8");
      const listings: ListingRecord[] = JSON.parse(raw);

      expect(listings.length).toBeGreaterThan(500);

      const idSet = new Set<string>();
      const idPattern = /^apt-(lihtc|mf|osm)-[a-zA-Z0-9_\-]+$/;

      for (const item of listings) {
        expect(item.id).toMatch(idPattern);
        expect(idSet.has(item.id)).toBe(false);
        idSet.add(item.id);

        expect(item.kind).toBe("apartment");
        expect(item.propertyType).toBe("Apartment complex");
        expect(item.rent).toBeGreaterThan(500);
        expect(item.value).toBeNull();
        expect(item.sqft).toBeNull();

        // Coordinates within Utah bounds
        expect(item.lat).toBeGreaterThanOrEqual(36.9);
        expect(item.lat).toBeLessThanOrEqual(42.1);
        expect(item.lng).toBeGreaterThanOrEqual(-114.1);
        expect(item.lng).toBeLessThanOrEqual(-109.0);

        // Specific record links, zero generic copyright links
        expect(item.sourceUrl).not.toContain("openstreetmap.org/copyright");
        expect(item.sourceUrl.length).toBeGreaterThan(10);
      }

      expect(idSet.size).toBe(listings.length);
    });

    it("strictly isolates municipal boundaries (excludes Kamas from Heber, Payson/Springville from Spanish Fork)", () => {
      const raw = readFileSync(APARTMENTS_FILE, "utf-8");
      const listings: ListingRecord[] = JSON.parse(raw);

      const heberListings = listings.filter((l) => l.cityId === "heber-city");
      expect(heberListings.length).toBeGreaterThan(0);
      for (const h of heberListings) {
        expect((h.address || "").toLowerCase()).not.toContain("kamas");
        expect(h.name.toLowerCase()).not.toContain("meadow view");
      }

      const sfListings = listings.filter((l) => l.cityId === "spanish-fork");
      expect(sfListings.length).toBe(2);
      const sfNames = sfListings.map((s) => s.name);
      expect(sfNames).toContain("DIAMOND FORK APTS.");
      expect(sfNames).toContain("PIONEER VILLA SENIOR COMMUNITY");

      // Verify Payson and Springville complexes are not in Spanish Fork
      for (const s of sfListings) {
        expect(s.name).not.toBe("RETIREMENT MANOR");
        expect(s.name).not.toBe("ROBBINS CARE CENTER");
        expect(s.name).not.toBe("Hobble Creek Apartments");
      }
    });
  });

  describe("data/listings/apartments_id_migration.json dictionary", () => {
    it("exists and documents legacy positional ID migrations & collisions", () => {
      expect(existsSync(MIGRATION_FILE)).toBe(true);
      const raw = readFileSync(MIGRATION_FILE, "utf-8");
      const migration = JSON.parse(raw);

      expect(migration.totalMapped).toBeGreaterThan(1000);
      expect(migration.collisions.length).toBe(2);

      const collisionIds = migration.collisions.map((c: any) => c.oldId);
      expect(collisionIds).toContain("apt-spanish-fork-5");
      expect(collisionIds).toContain("apt-spanish-fork-6");

      const sf5 = migration.collisions.find((c: any) => c.oldId === "apt-spanish-fork-5");
      expect(sf5.version_c09489c.name).toBe("PIONEER VILLA SENIOR COMMUNITY");
      expect(sf5.version_0a869d8.name).toBe("RETIREMENT MANOR");
      expect(sf5.version_c09489c.stableId).toBe("apt-mf-800218125");
    });
  });
});
