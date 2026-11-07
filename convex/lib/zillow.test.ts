import { describe, expect, it } from "vitest";
import { MICROLINK_DAILY_CAP, decideFetch, microlinkRequest, parseMicrolink, zillowUrl } from "./zillow";

describe("zillowUrl", () => {
  it("builds an address search URL, appending town and state", () => {
    expect(zillowUrl("123 Main St", "Provo", "home")).toBe("https://www.zillow.com/homes/123-Main-St%2C-Provo%2C-UT_rb/");
  });
  it("keeps addresses that already include UT", () => {
    expect(zillowUrl("123 Main St, Provo, UT 84601", "Provo", "home")).toBe("https://www.zillow.com/homes/123-Main-St%2C-Provo%2C-UT-84601_rb/");
  });
  it("falls back to the town pages", () => {
    expect(zillowUrl(null, "Salt Lake City", "home")).toBe("https://www.zillow.com/salt-lake-city-ut/");
    expect(zillowUrl("  ", "St. George", "apartment")).toBe("https://www.zillow.com/st-george-ut/apartments/");
  });
});

describe("decideFetch", () => {
  const now = 1_000_000_000;
  const base = { now, callsLast24h: 0, hasApiKey: false };
  it("fetches when nothing is cached", () => expect(decideFetch({ ...base, row: null })).toBe("fetch"));
  it("never refetches settled rows", () => {
    expect(decideFetch({ ...base, row: { status: "ok", fetchedAt: now - 99 * 3600_000 } })).toBe("cached");
    expect(decideFetch({ ...base, row: { status: "no_image", fetchedAt: now - 1 } })).toBe("cached");
  });
  it("retries error rows only after an hour", () => {
    expect(decideFetch({ ...base, row: { status: "error", fetchedAt: now - 59 * 60_000 } })).toBe("cached");
    expect(decideFetch({ ...base, row: { status: "error", fetchedAt: now - 61 * 60_000 } })).toBe("fetch");
  });
  it("enforces the free-tier cap, but not with an API key", () => {
    expect(decideFetch({ ...base, row: null, callsLast24h: MICROLINK_DAILY_CAP - 1 })).toBe("fetch");
    expect(decideFetch({ ...base, row: null, callsLast24h: MICROLINK_DAILY_CAP })).toBe("budget_exhausted");
    expect(decideFetch({ ...base, row: null, callsLast24h: 500, hasApiKey: true })).toBe("fetch");
  });
});

describe("microlink helpers", () => {
  it("uses the pro endpoint and header only with a key", () => {
    expect(microlinkRequest("https://z.com/a b")).toEqual({ url: "https://api.microlink.io/?url=https%3A%2F%2Fz.com%2Fa%20b", headers: {} });
    const pro = microlinkRequest("https://z.com/", "k");
    expect(pro.url.startsWith("https://pro.microlink.io/")).toBe(true);
    expect(pro.headers).toEqual({ "x-api-key": "k" });
  });
  it("parses success, no-image and failure bodies", () => {
    expect(parseMicrolink({ status: "success", data: { title: "T", url: "https://z/p", image: { url: "https://photos.zillowstatic.com/x.jpg" } } }))
      .toEqual({ pageUrl: "https://z/p", imageUrl: "https://photos.zillowstatic.com/x.jpg", title: "T", status: "ok" });
    expect(parseMicrolink({ status: "success", data: { title: "T", url: "https://z/p", image: null } }).status).toBe("no_image");
    expect(parseMicrolink({ status: "fail" }).status).toBe("error");
    expect(parseMicrolink(null).status).toBe("error");
  });
});
