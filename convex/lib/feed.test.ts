import { describe, expect, it } from "vitest";
import { isRateLimited, MAX_BODY, newestFirst, nextLikes, shouldHide, validateBody } from "./feed";

describe("validateBody", () => {
  it("trims", () => expect(validateBody("  hi  ")).toEqual({ ok: true, body: "hi" }));
  it("rejects empty and whitespace", () => {
    expect(validateBody("").ok).toBe(false);
    expect(validateBody(" \n\t ").ok).toBe(false);
  });
  it("enforces the limit after trimming", () => {
    expect(validateBody(" " + "a".repeat(MAX_BODY) + " ").ok).toBe(true);
    expect(validateBody("a".repeat(MAX_BODY + 1)).ok).toBe(false);
  });
});

describe("shouldHide", () => {
  it("hides at 3 reports", () => {
    expect([0, 1, 2, 3, 4].map(shouldHide)).toEqual([false, false, false, true, true]);
  });
});

describe("nextLikes", () => {
  it("adds and removes", () => {
    expect(nextLikes(2, false)).toBe(3);
    expect(nextLikes(2, true)).toBe(1);
  });
  it("never goes below zero", () => expect(nextLikes(0, true)).toBe(0));
});

describe("isRateLimited", () => {
  const now = 1_000_000;
  it("allows 4 recent, blocks 5", () => {
    expect(isRateLimited([now - 1, now - 2, now - 3, now - 4], now)).toBe(false);
    expect(isRateLimited([now - 1, now - 2, now - 3, now - 4, now - 5], now)).toBe(true);
  });
  it("ignores posts older than a minute", () => {
    expect(isRateLimited([now - 1, now - 2, now - 3, now - 4, now - 60_000], now)).toBe(false);
  });
});

describe("newestFirst", () => {
  it("sorts descending without mutating", () => {
    const rows = [{ _creationTime: 1 }, { _creationTime: 3 }, { _creationTime: 2 }];
    expect(newestFirst(rows).map((r) => r._creationTime)).toEqual([3, 2, 1]);
    expect(rows[0]._creationTime).toBe(1);
  });
});
