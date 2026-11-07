import { describe, expect, it } from "vitest";
import { netMigrationByCounty } from "./net_migration";

const head = "SUMLEV,STATE,CTYNAME,POPESTIMATE2020,NETMIG2021,NETMIG2022,NETMIG2023,NETMIG2024";
describe("net migration", () => {
  it("sums July-to-July years per 1,000 and keeps only Utah counties", () => {
    const csv = [head, "050,49,Utah County,1000,10,20,-5,5", "040,49,Utah,5000,1,1,1,1", "050,06,Utah County,1000,99,99,99,99"].join("\n");
    expect(netMigrationByCounty(csv)).toEqual({ Utah: 30 });
  });
  it("keeps outflow negative", () => {
    expect(netMigrationByCounty([head, "050,49,Grand County,200,-1,-1,-1,-1"].join("\n"))).toEqual({ Grand: -20 });
  });
  it("rejects a file without the expected columns", () => {
    expect(() => netMigrationByCounty("SUMLEV,STATE\n050,49")).toThrow();
  });
});
