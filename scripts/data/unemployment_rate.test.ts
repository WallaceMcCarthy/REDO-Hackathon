import { describe, expect, it } from "vitest";
import { annualAverages, lausSeries } from "./unemployment_rate";

const body = (data: object[]) => ({ status: "REQUEST_SUCCEEDED", Results: { series: [{ seriesID: "S1", data }, { seriesID: "S2", data: [{ year: "2024", period: "M01", value: "9" }] }] } });
describe("unemployment rate", () => {
  it("takes the M13 annual average for the requested year only", () => {
    expect(annualAverages(body([{ year: "2024", period: "M13", value: "3.3" }, { year: "2023", period: "M13", value: "2.9" }]), "2024")).toEqual({ S1: 3.3 });
  });
  it("skips unavailable values instead of reading them as zero", () => {
    expect(annualAverages(body([{ year: "2024", period: "M13", value: "-" }]), "2024")).toEqual({});
  });
  it("fails loudly when BLS rejects the request", () => {
    expect(() => annualAverages({ status: "REQUEST_NOT_PROCESSED", message: ["limit"] }, "2024")).toThrow();
  });
  it("builds the county series id", () => {
    expect(lausSeries("035")).toBe("LAUCN490350000000003");
  });
});
