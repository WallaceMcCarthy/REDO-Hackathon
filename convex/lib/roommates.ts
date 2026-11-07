/** Roommate matching and contact rules. Pure: no Convex imports, so both are testable without a backend. */

export type RoommateProfile = {
  userId: string;
  budgetMin: number;
  budgetMax: number;
  cityIds: string[];
  moveIn: number; // ms since epoch
  tags: string[];
  active: boolean;
};

export type ConnectionStatus = "pending" | "accepted" | "declined";
export type Connection = { fromUserId: string; toUserId: string; status: ConnectionStatus };

export type RoommateMatch = {
  userId: string;
  score: number; // 0..100
  sharedCityIds: string[];
  sharedTags: string[];
  reasons: string[];
};

const DAY_MS = 86_400_000;
const FULL_DATE_WINDOW_DAYS = 14; // moving within two weeks counts as the same date
const NO_DATE_CREDIT_DAYS = 90;
const WEIGHTS = { towns: 0.5, budget: 0.3, date: 0.2 };

function townScore(shared: number, a: RoommateProfile, b: RoommateProfile): number {
  const fewer = Math.min(a.cityIds.length, b.cityIds.length);
  return fewer === 0 ? 0 : shared / fewer;
}

/** Shared budget range as a share of the narrower range. Two identical single amounts count as a full match. */
function budgetScore(a: RoommateProfile, b: RoommateProfile): number {
  const overlap = Math.min(a.budgetMax, b.budgetMax) - Math.max(a.budgetMin, b.budgetMin);
  if (overlap < 0) return 0;
  const narrower = Math.min(a.budgetMax - a.budgetMin, b.budgetMax - b.budgetMin);
  return narrower === 0 ? 1 : overlap / narrower;
}

function dateScore(a: RoommateProfile, b: RoommateProfile): number {
  const days = Math.abs(a.moveIn - b.moveIn) / DAY_MS;
  if (days <= FULL_DATE_WINDOW_DAYS) return 1;
  if (days >= NO_DATE_CREDIT_DAYS) return 0;
  return 1 - (days - FULL_DATE_WINDOW_DAYS) / (NO_DATE_CREDIT_DAYS - FULL_DATE_WINDOW_DAYS);
}

/** Null when these two can't live together: no shared town, or budgets that never meet. */
export function scoreMatch(me: RoommateProfile, other: RoommateProfile): RoommateMatch | null {
  const theirs = new Set(other.cityIds);
  const sharedCityIds = [...new Set(me.cityIds)].filter((id) => theirs.has(id));
  const budget = budgetScore(me, other);
  if (sharedCityIds.length === 0 || budget === 0) return null;

  const date = dateScore(me, other);
  const score = 100 * (WEIGHTS.towns * townScore(sharedCityIds.length, me, other) + WEIGHTS.budget * budget + WEIGHTS.date * date);
  const theirTags = new Set(other.tags);
  const reasons = [
    `${sharedCityIds.length} shared ${sharedCityIds.length === 1 ? "town" : "towns"}`,
    budget === 1 ? "Budgets line up" : "Budgets overlap",
    ...(date === 1 ? ["Moving around the same time"] : []),
  ];
  return {
    userId: other.userId,
    score: Math.round(score),
    sharedCityIds,
    sharedTags: [...new Set(me.tags)].filter((tag) => theirTags.has(tag)),
    reasons,
  };
}

/** Best matches first. `excludeUserIds` covers people already connected, declined or blocked. */
export function rankMatches(
  me: RoommateProfile,
  others: readonly RoommateProfile[],
  excludeUserIds: readonly string[] = [],
  limit = 20,
): RoommateMatch[] {
  const excluded = new Set([me.userId, ...excludeUserIds]);
  return others
    .filter((other) => other.active && !excluded.has(other.userId))
    .flatMap((other) => scoreMatch(me, other) ?? [])
    .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
    .slice(0, limit);
}

/** Contact details are shared only after both sides accept, and only between those two people. */
export function canSeeContact(viewerUserId: string, profileUserId: string, connections: readonly Connection[]): boolean {
  if (viewerUserId === profileUserId) return true;
  return connections.some(
    (c) =>
      c.status === "accepted" &&
      ((c.fromUserId === viewerUserId && c.toUserId === profileUserId) ||
        (c.fromUserId === profileUserId && c.toUserId === viewerUserId)),
  );
}
