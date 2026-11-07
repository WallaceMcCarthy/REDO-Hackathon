import { describe, expect, it } from "vitest";
import { checkOwner, checkParent, cleanComment, nextReportState } from "./social";

describe("comment policies", () => {
  it("rejects empty, oversized and hidden-control text while preserving normal paragraphs", () => {
    expect(cleanComment("  Thanks!\nThis helps.  ")).toBe("Thanks!\nThis helps.");
    expect(cleanComment("x".repeat(2000))).toHaveLength(2000);
    for (const text of [" \n\t", "x".repeat(2001), "hello\u0000there"]) expect(() => cleanComment(text)).toThrow();
  });
  it("allows one reply level only on the same visible discussion", () => {
    const parent = { targetType: "town" as const, targetId: "provo", parentId: null, hidden: false };
    expect(() => checkParent(parent, "town", "provo")).not.toThrow();
    expect(() => checkParent(parent, "town", "orem")).toThrow("same discussion");
    expect(() => checkParent(parent, "listing", "provo")).toThrow("same discussion");
    expect(() => checkParent({ ...parent, parentId: "another" }, "town", "provo")).toThrow("one level");
    expect(() => checkParent({ ...parent, hidden: true }, "town", "provo")).toThrow("unavailable");
    expect(() => checkParent(null, "town", "provo")).toThrow("unavailable");
  });
  it("enforces authorship and the third-report moderation threshold", () => {
    expect(() => checkOwner("alice", "alice")).not.toThrow();
    expect(() => checkOwner("mallory", "alice")).toThrow("own comment");
    expect(nextReportState(0)).toEqual({ reports: 1, hidden: false });
    expect(nextReportState(1)).toEqual({ reports: 2, hidden: false });
    expect(nextReportState(2)).toEqual({ reports: 3, hidden: true });
  });
});
