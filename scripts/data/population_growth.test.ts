import { describe, expect, it } from "vitest";
import { growthByPlace } from "./population_growth";
import { placeKey } from "./town_lookup";

const csv = [
  "SUMLEV,STATE,COUNTY,PLACE,COUSUB,CONCIT,PRIMGEO_FLAG,FUNCSTAT,NAME,STNAME,ESTIMATESBASE2020,POPESTIMATE2020,POPESTIMATE2024",
  "162,49,000,62470,00000,00000,0,A,Provo city,Utah,100,100,110",
  "157,49,049,62470,00000,00000,1,A,Provo city,Utah,1,1,1",
  "162,49,000,67000,00000,00000,0,A,Salt Lake City city,Utah,200,200,190",
].join("\n");

describe("population growth", () => {
  it("uses place rows only and rounds to 0.1%, including declines", () => {
    expect(growthByPlace(csv)).toEqual({ provo: 10, "salt lake": -5 });
  });
  it("matches census suffixes to town names", () => {
    expect(placeKey("Salt Lake City city")).toBe(placeKey("Salt Lake City"));
    expect(placeKey("Heber city")).toBe(placeKey("Heber City"));
  });
  it("rejects a file without the expected columns", () => {
    expect(() => growthByPlace("SUMLEV,NAME\n162,x")).toThrow();
  });
});
