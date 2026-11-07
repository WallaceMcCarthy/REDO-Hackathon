import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssessorRow } from "../../convex/lib/assessor";
import { asAssessorRow, asParcelRow, chunkRows, loadTown, parcelPages, townRows, type Progress } from "./assessor_homes";
import { fetchWithBackoff, type Parcel, type Point } from "./listings_homes";

const rings: Point[][] = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
const town = { id: "example", name: "Example", county: "Salt Lake", lat: 5, lng: 5 };
const parcel = (objectId: number, changes: Record<string, string | number | null> = {}, x = 5): Parcel => ({
  attributes: { OBJECTID: objectId, PARCEL_ID: `p${objectId}`, PARCEL_ADD: "10 Example St", PROP_CLASS: "Residential", TOTAL_MKT_VALUE: 420000, BLDG_SQFT: 1500, BUILT_YR: 1980, HOUSE_CNT: "1", CURRENT_ASOF: Date.UTC(2025, 0, 1), ...changes },
  centroid: { x, y: 5 },
});
const row = (n: number, address = "1 Long Example Street"): AssessorRow => ({ id: `salt-lake-${String(n).padStart(6, "0")}`, cityId: "example", county: "Salt Lake", address, lat: 5, lng: 5, value: n + 1, sqft: null, yearBuilt: null, units: null, propertyType: "Residential", asOf: "2025-01-01" });
const pagedRequest = (pages: Parcel[][]) => vi.fn(async (_url: string, params: Record<string, string> = {}) => {
  const after = Number(/OBJECTID > (\d+)/.exec(params.where)![1]);
  return { features: pages.find((page) => Number(page[0].attributes.OBJECTID) > after) ?? [] };
});

afterEach(() => vi.unstubAllGlobals());

describe("assessor parcel stream", () => {
  it("keeps the public listing id so existing saves still resolve, and fetches no owner data", () => {
    expect(asAssessorRow(parcel(7), town, rings)).toEqual({ id: "salt-lake-p7", cityId: "example", county: "Salt Lake", address: "10 Example St", lat: 5, lng: 5, value: 420000, sqft: 1500, yearBuilt: 1980, units: 1, propertyType: "Residential", asOf: "2025-01-01" });
  });

  it("leaves source gaps null or out rather than inventing values", () => {
    expect(asAssessorRow(parcel(1, { BLDG_SQFT: null }), town, rings)).toMatchObject({ sqft: null, yearBuilt: 1980 });
    expect(asAssessorRow(parcel(1, { TOTAL_MKT_VALUE: 0 }), town, rings)).toBeNull();
  });

  it("treats repeated LIR rows as one parcel described by its largest structure", () => {
    const house = parcel(1, { PARCEL_ID: "K-B-10-9", HOUSE_CNT: "2", TOTAL_MKT_VALUE: 231836, BLDG_SQFT: 1088, BUILT_YR: 1942 });
    const shed = parcel(2, { PARCEL_ID: "K-B-10-9", HOUSE_CNT: "2", TOTAL_MKT_VALUE: 231836, BLDG_SQFT: 170, BUILT_YR: 2014 });
    for (const rows of [[house, shed], [shed, house]]) {
      expect(asParcelRow(rows, town, rings)).toMatchObject({ id: "salt-lake-K-B-10-9", value: 231836, sqft: 1088, yearBuilt: 1942, units: null });
    }
    expect(asParcelRow([parcel(3)], town, rings)).toMatchObject({ units: 1 });
  });

  it("keeps parcels with up to four structures and excludes larger complexes", () => {
    expect(asParcelRow([parcel(1, { HOUSE_CNT: "4" })], town, rings)).not.toBeNull();
    expect(asParcelRow([parcel(1, { HOUSE_CNT: "5" })], town, rings)).toBeNull();
    expect(asParcelRow([parcel(1, { HOUSE_CNT: "1-11" })], town, rings)).toBeNull();
  });

  it("walks every page by OBJECTID until the source returns an empty page", async () => {
    const request = pagedRequest([[parcel(1), parcel(2)], [parcel(9)]]);
    const seen: number[] = [];
    for await (const page of parcelPages("https://example.com/0", rings, request as never)) seen.push(...page.map((item) => Number(item.attributes.OBJECTID)));
    expect(seen).toEqual([1, 2, 9]);
    expect(request.mock.calls.map(([, params]) => /OBJECTID > (\d+)/.exec(params!.where)![1])).toEqual(["0", "2", "9"]);
  });

  it("drops parcels outside the town and merges one parcel's rows across a page boundary", async () => {
    const rows = await townRows(town, rings, pagedRequest([[parcel(1, { BLDG_SQFT: 200 }), parcel(2, {}, 50)], [parcel(3, { PARCEL_ID: "p1", BLDG_SQFT: 900 })]]) as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "salt-lake-p1", sqft: 900 });
  });

  it("reads a second county for towns that cross a county line, keeping each county's id", async () => {
    const request = vi.fn(async (url: string, params: Record<string, string> = {}) => ({ features: params.where.includes("OBJECTID > 0") ? [parcel(1)] : [] }));
    const rows = await townRows({ ...town, id: "draper" }, rings, request as never);
    expect(rows.map((item) => item.id)).toEqual(["salt-lake-p1", "utah-p1"]);
    expect(rows.map((item) => item.county)).toEqual(["Salt Lake", "Utah"]);
  });

  it("bounds every chunk by rows and by bytes", () => {
    expect(chunkRows(Array.from({ length: 2500 }, (_, n) => row(n))).map((chunk) => chunk.length)).toEqual([1000, 1000, 500]);
    const wide = chunkRows(Array.from({ length: 900 }, (_, n) => row(n, "x".repeat(1000))));
    expect(wide.length).toBeGreaterThan(1);
    for (const chunk of wide) expect(JSON.stringify(chunk).length).toBeLessThanOrEqual(400_000);
  });

  it("resumes after a crash at the failed chunk, and a finished town costs no calls", async () => {
    const rows = Array.from({ length: 2500 }, (_, n) => row(n));
    const progress: Progress = {};
    const save = async () => {};
    const crash = vi.fn().mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error("network"); });
    await expect(loadTown("example", rows, progress, save, crash)).rejects.toThrow("network");
    expect(progress.example.done).toBe(1);
    const resume = vi.fn();
    await loadTown("example", rows, progress, save, resume);
    expect(resume.mock.calls.map(([chunk]) => chunk[0].id)).toEqual([rows[1000].id, rows[2000].id]);
    const again = vi.fn();
    await loadTown("example", rows, progress, save, again);
    expect(again).not.toHaveBeenCalled();
  });

  it("reloads a town from the start when the source rows changed", async () => {
    const progress: Progress = {};
    await loadTown("example", [row(1)], progress, async () => {}, () => {});
    const upsert = vi.fn();
    await loadTown("example", [row(1), row(2)], progress, async () => {}, upsert);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
  });
});

describe("ArcGIS politeness", () => {
  const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

  it("honors Retry-After, backs off on error bodies, and then returns the data", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply({}, 429, { "retry-after": "30" })).mockResolvedValueOnce(reply({ error: { message: "busy" } })).mockResolvedValueOnce(reply({ features: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const sleep = vi.fn(async () => {});
    await expect(fetchWithBackoff(new URL("https://example.com/query"), sleep)).resolves.toEqual({ features: [] });
    expect(sleep.mock.calls.map(([ms]: number[]) => ms)).toEqual([30000, 4000, 250]);
  });

  it("gives up after a bounded number of attempts", async () => {
    const fetchMock = vi.fn(async () => reply({}, 503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchWithBackoff(new URL("https://example.com/query"), async () => {})).rejects.toThrow("HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
