import { describe, expect, it } from "vitest";
import { pickPlaces } from "./acs_places";
import { ownerShare } from "./owner_occupancy";

const lines = ["GEO_ID|B25003_E001|B25003_E002", "1600000US4962470|1000|640", "1600000US4967000|-666666666|-666666666", "1400000US49035100100|5|5"];
describe("owner occupancy", () => {
  it("reads only place rows and treats suppressed cells as missing, not zero", () => {
    const rows = pickPlaces(lines, { provo: "62470", "salt-lake-city": "67000", moab: "50700" }, ["B25003_E001", "B25003_E002"]);
    expect(rows.provo).toEqual({ B25003_E001: 1000, B25003_E002: 640 });
    expect(rows["salt-lake-city"]).toEqual({ B25003_E001: null, B25003_E002: null });
    expect(rows.moab).toBeUndefined();
  });
  it("computes the share and refuses missing inputs", () => {
    expect(ownerShare(640, 1000)).toBe(0.64);
    expect(ownerShare(null, 1000)).toBeNaN();
    expect(ownerShare(5, 0)).toBeNaN();
  });
  it("rejects an unexpected column layout", () => {
    expect(() => pickPlaces(["GEO_ID|X"], {}, ["B25003_E001"])).toThrow();
  });
});
