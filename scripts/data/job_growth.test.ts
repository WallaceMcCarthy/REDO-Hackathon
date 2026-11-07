import { describe, expect, it } from "vitest";
import { countyEmployment } from "./job_growth";

const head = '"area_fips","own_code","industry_code","agglvl_code","annual_avg_emplvl","disclosure_code"';
describe("job growth", () => {
  it("reads only the all-ownership, all-industry county total", () => {
    const csv = [head, '"49035","5","10","71","600000",""', '"49035","0","10","70","796203",""', '"49035","0","23","75","50000",""'].join("\n");
    expect(countyEmployment(csv)).toBe(796203);
  });
  it("refuses a withheld total instead of using zero", () => {
    expect(() => countyEmployment([head, '"49009","0","10","70","0","N"'].join("\n"))).toThrow();
  });
  it("fails when the total row is missing", () => {
    expect(() => countyEmployment([head, '"49035","0","23","75","5",""'].join("\n"))).toThrow();
  });
});
