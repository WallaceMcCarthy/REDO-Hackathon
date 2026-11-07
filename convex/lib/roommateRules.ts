/** Roommate input validation and request rules. Pure: no Convex imports, so every privacy rule is testable without a backend. */
import type { Connection } from "./roommates";

/** Habits only. Never add tags about race, religion, national origin, sex, disability or family status (Fair Housing). */
export const ROOMMATE_TAGS = [
  "early-bird",
  "night-owl",
  "non-smoker",
  "pets-welcome",
  "quiet",
  "social",
  "tidy",
  "works-from-home",
] as const;
export type RoommateTag = (typeof ROOMMATE_TAGS)[number];

export const LIMITS = { maxBudget: 100_000, maxCities: 10, bio: 500, contact: 200 };
const MAX_MOVE_IN = 4_102_444_800_000; // year 2100

export type ProfileInput = {
  budgetMin: number;
  budgetMax: number;
  cityIds: string[];
  moveIn: number;
  tags: string[];
  bio: string;
  contact: string;
};

const isMoney = (n: number) => Number.isFinite(n) && n >= 0 && n <= LIMITS.maxBudget;

/** Returns the cleaned profile or throws a user-readable Error. `validCityIds` is the set of real town ids. */
export function validateProfile(input: ProfileInput, validCityIds: ReadonlySet<string>): ProfileInput {
  if (!isMoney(input.budgetMin) || !isMoney(input.budgetMax)) throw new Error("Budget must be between 0 and 100,000.");
  if (input.budgetMin > input.budgetMax) throw new Error("Minimum budget can't be above maximum.");
  if (!Number.isFinite(input.moveIn) || input.moveIn < 0 || input.moveIn > MAX_MOVE_IN) throw new Error("Move-in date is not valid.");
  const cityIds = [...new Set(input.cityIds)];
  if (cityIds.length === 0 || cityIds.length > LIMITS.maxCities) throw new Error(`Pick 1 to ${LIMITS.maxCities} towns.`);
  if (!cityIds.every((id) => validCityIds.has(id))) throw new Error("Unknown town.");
  const tags = [...new Set(input.tags)];
  if (!tags.every((t) => (ROOMMATE_TAGS as readonly string[]).includes(t))) throw new Error("Unknown lifestyle tag.");
  const bio = input.bio.trim();
  const contact = input.contact.trim();
  if (bio.length > LIMITS.bio) throw new Error(`Bio is limited to ${LIMITS.bio} characters.`);
  if (contact.length === 0 || contact.length > LIMITS.contact) throw new Error(`Contact is required, up to ${LIMITS.contact} characters.`);
  return { budgetMin: input.budgetMin, budgetMax: input.budgetMax, cityIds, moveIn: input.moveIn, tags, bio, contact };
}

const between = (c: Connection, a: string, b: string) =>
  (c.fromUserId === a && c.toUserId === b) || (c.fromUserId === b && c.toUserId === a);

/** Everyone I already have a row with, in any status and either direction. Matches hide them all. */
export function usersToExclude(me: string, connections: readonly Connection[]): string[] {
  return connections.filter((c) => c.fromUserId === me || c.toUserId === me).map((c) => (c.fromUserId === me ? c.toUserId : c.fromUserId));
}

/**
 * "create" inserts a pending row. "noop" means a row already exists between the pair, in any status or direction,
 * so a repeat or a request after a decline changes nothing. The caller answers both the same way so a decline is not revealed.
 */
export function planRequest(me: string, target: string, connections: readonly Connection[]): "create" | "noop" {
  if (me === target) throw new Error("You can't request yourself.");
  return connections.some((c) => between(c, me, target)) ? "noop" : "create";
}

/** Only the recipient may answer, and only while the request is pending. */
export function canRespond(me: string, c: Connection): boolean {
  return c.toUserId === me && c.status === "pending";
}
