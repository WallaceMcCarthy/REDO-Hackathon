import { describe, expect, it } from "vitest";
import { canRespond, planRequest, ROOMMATE_TAGS, usersToExclude, validateProfile, type ProfileInput } from "./roommateRules";
import { canSeeContact, rankMatches, type Connection, type RoommateProfile } from "./roommates";

const towns = new Set(["provo", "orem"]);
const good: ProfileInput = { budgetMin: 800, budgetMax: 1200, cityIds: ["provo"], moveIn: 1_700_000_000_000, tags: ["quiet"], bio: " hi ", contact: " a@b.co " };
const bad = (over: Partial<ProfileInput>, msg: RegExp) => expect(() => validateProfile({ ...good, ...over }, towns)).toThrow(msg);

describe("validateProfile", () => {
  it("trims and dedupes", () => {
    expect(validateProfile({ ...good, cityIds: ["provo", "provo"], tags: ["quiet", "quiet"] }, towns)).toMatchObject({ bio: "hi", contact: "a@b.co", cityIds: ["provo"], tags: ["quiet"] });
  });
  it("rejects bad budgets", () => {
    bad({ budgetMin: 1300 }, /above maximum/);
    bad({ budgetMin: -1 }, /Budget/);
    bad({ budgetMax: NaN }, /Budget/);
    bad({ budgetMax: 1e9 }, /Budget/);
  });
  it("rejects unknown towns and tags", () => {
    bad({ cityIds: ["narnia"] }, /Unknown town/);
    bad({ cityIds: [] }, /Pick/);
    bad({ tags: ["christian"] }, /Unknown lifestyle tag/);
  });
  it("enforces length limits and required contact", () => {
    bad({ bio: "x".repeat(501) }, /Bio/);
    bad({ contact: "  " }, /Contact/);
    bad({ contact: "x".repeat(201) }, /Contact/);
  });
  it("keeps protected-class words out of the allow-list", () => {
    expect(ROOMMATE_TAGS.join(" ")).not.toMatch(/race|relig|christian|muslim|jewish|national|male|female|gender|disab|famil|kids|child|pregnan/);
  });
});

describe("planRequest", () => {
  const row = (fromUserId: string, toUserId: string, status: Connection["status"]): Connection => ({ fromUserId, toUserId, status });
  it("refuses a self request", () => expect(() => planRequest("a", "a", [])).toThrow(/yourself/));
  it("creates the first request", () => expect(planRequest("a", "b", [row("c", "d", "pending")])).toBe("create"));
  it("does not duplicate a repeat request or a crossed one", () => {
    expect(planRequest("a", "b", [row("a", "b", "pending")])).toBe("noop");
    expect(planRequest("a", "b", [row("b", "a", "pending")])).toBe("noop");
  });
  it("lets a declined person neither re-request nor be re-requested", () => {
    expect(planRequest("a", "b", [row("a", "b", "declined")])).toBe("noop");
    expect(planRequest("b", "a", [row("a", "b", "declined")])).toBe("noop");
  });
});

describe("canRespond", () => {
  const c: Connection = { fromUserId: "a", toUserId: "b", status: "pending" };
  it("allows only the recipient", () => {
    expect(canRespond("b", c)).toBe(true);
    expect(canRespond("a", c)).toBe(false);
    expect(canRespond("z", c)).toBe(false);
  });
  it("is final once answered", () => {
    expect(canRespond("b", { ...c, status: "declined" })).toBe(false);
    expect(canRespond("b", { ...c, status: "accepted" })).toBe(false);
  });
});

describe("matches exclusion", () => {
  const p = (userId: string): RoommateProfile => ({ userId, budgetMin: 800, budgetMax: 1200, cityIds: ["provo"], moveIn: 0, tags: [], active: true });
  it("drops pending, accepted and declined people in either direction", () => {
    const conns: Connection[] = [
      { fromUserId: "me", toUserId: "p", status: "pending" },
      { fromUserId: "a", toUserId: "me", status: "accepted" },
      { fromUserId: "me", toUserId: "d", status: "declined" },
      { fromUserId: "x", toUserId: "y", status: "pending" },
    ];
    const ids = rankMatches(p("me"), ["p", "a", "d", "x", "free"].map(p), usersToExclude("me", conns)).map((m) => m.userId);
    expect(ids).toEqual(["free", "x"]);
  });
});

describe("contact visibility", () => {
  it("is hidden for every non-accepted status and from outsiders", () => {
    for (const status of ["pending", "declined"] as const) expect(canSeeContact("a", "b", [{ fromUserId: "a", toUserId: "b", status }])).toBe(false);
    expect(canSeeContact("c", "b", [{ fromUserId: "a", toUserId: "b", status: "accepted" }])).toBe(false);
  });
});
