import { describe, expect, it } from "vitest";
import { canSeeContact, rankMatches, scoreMatch, type Connection, type RoommateProfile } from "./roommates";

const DAY = 86_400_000;
const person = (userId: string, over: Partial<RoommateProfile> = {}): RoommateProfile => ({
  userId,
  budgetMin: 800,
  budgetMax: 1200,
  cityIds: ["provo", "orem"],
  moveIn: 100 * DAY,
  tags: ["quiet"],
  active: true,
  ...over,
});

describe("scoreMatch", () => {
  it("gives identical plans a full score", () => {
    expect(scoreMatch(person("a"), person("b"))?.score).toBe(100);
  });

  it("rejects people with no shared town", () => {
    expect(scoreMatch(person("a"), person("b", { cityIds: ["moab"] }))).toBeNull();
  });

  it("rejects budgets that never meet", () => {
    expect(scoreMatch(person("a"), person("b", { budgetMin: 1300, budgetMax: 1500 }))).toBeNull();
  });

  it("scores a later move-in lower, down to no date credit", () => {
    const near = scoreMatch(person("a"), person("b", { moveIn: 140 * DAY }))!.score;
    const far = scoreMatch(person("a"), person("c", { moveIn: 300 * DAY }))!.score;
    expect(near).toBeLessThan(100);
    expect(far).toBe(80);
    expect(far).toBeLessThan(near);
  });

  it("treats two identical single-amount budgets as a match", () => {
    const fixed = { budgetMin: 1000, budgetMax: 1000 };
    expect(scoreMatch(person("a", fixed), person("b", fixed))?.score).toBe(100);
  });

  it("reports what the two people share", () => {
    const match = scoreMatch(person("a", { tags: ["quiet", "pets"] }), person("b", { cityIds: ["orem"], tags: ["pets"] }));
    expect(match?.sharedCityIds).toEqual(["orem"]);
    expect(match?.sharedTags).toEqual(["pets"]);
    expect(match?.reasons[0]).toBe("1 shared town");
  });
});

describe("rankMatches", () => {
  it("leaves out me, inactive profiles and excluded people, best first", () => {
    const me = person("me");
    const others = [
      me,
      person("away", { active: false }),
      person("blocked"),
      person("later", { moveIn: 300 * DAY }),
      person("best"),
    ];
    expect(rankMatches(me, others, ["blocked"]).map((m) => m.userId)).toEqual(["best", "later"]);
  });

  it("applies the limit", () => {
    const others = ["b", "c", "d"].map((id) => person(id));
    expect(rankMatches(person("a"), others, [], 2)).toHaveLength(2);
  });

  it("keeps every equally ranked profile reachable beyond twenty matches", () => {
    const others = Array.from({ length: 31 }, (_, i) => person(`person-${String(i).padStart(2, "0")}`));
    const ranked = rankMatches(person("me"), others);
    expect(ranked).toHaveLength(31);
    expect(ranked.map(m => m.userId)).toEqual(others.map(p => p.userId));
    expect(rankMatches(person("me"), [...others].reverse())).toEqual(ranked);
  });
});

describe("canSeeContact", () => {
  const link = (status: Connection["status"]): Connection[] => [{ fromUserId: "a", toUserId: "b", status }];

  it("hides contact until the request is accepted", () => {
    expect(canSeeContact("a", "b", link("pending"))).toBe(false);
    expect(canSeeContact("b", "a", link("pending"))).toBe(false);
    expect(canSeeContact("a", "b", link("declined"))).toBe(false);
  });

  it("shows contact both ways once accepted", () => {
    expect(canSeeContact("a", "b", link("accepted"))).toBe(true);
    expect(canSeeContact("b", "a", link("accepted"))).toBe(true);
  });

  it("never exposes it to a third person", () => {
    expect(canSeeContact("c", "b", link("accepted"))).toBe(false);
  });

  it("always lets you see your own", () => {
    expect(canSeeContact("a", "a", [])).toBe(true);
  });
});
