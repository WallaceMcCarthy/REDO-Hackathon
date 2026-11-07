/**
 * Content moderation for free (no-payment) ads and comments, via the same
 * Jev provider and model as convex/lib/jev.ts (deliberately a separate,
 * standalone module: a different feature with its own quota, see #99).
 * Request/response shaping and the noul/choice question style mirror jev.ts.
 */
export type ModerationKind = "ad" | "comment";
export type ModerationVerdict = "allow" | "hold" | "reject";
export type ModerationJudgment = { verdict: ModerationVerdict; reasons: string[]; model: string };

/** Each policy is asked as an independent 0..1 "does this content contain X" question. */
const POLICIES = {
  hate_or_harassment: "hateful, harassing, or discriminatory language directed at a person or group",
  fair_housing: "language that illegally steers or discriminates in housing based on race, color, religion, sex, familial status, disability, or national origin (a Fair Housing Act concern)",
  sexual_content: "sexually explicit content",
  violence_or_illegal: "violence, credible threats, or promotion of clearly illegal activity",
  scam_or_phishing: "a scam, phishing attempt, or deceptive financial offer",
  spam: "spam, repeated junk text, or promotional content unrelated to housing",
  contact_info_leak: "a phone number, email address, or external messaging handle, shared to move the conversation off-platform",
} as const;

const MODEL = "jev-1.14.0";
const REJECT_THRESHOLD = 0.85;
const HOLD_THRESHOLD = 0.5;

export function moderationRequest(kind: ModerationKind, text: string, imageUrl?: string | null) {
  const trimmed = (text || "").trim().slice(0, 4000);
  const noun = kind === "ad" ? "advertisement" : "comment";
  const state: Record<string, unknown> = { kind, content: trimmed };
  if (imageUrl) state.imageUrl = imageUrl;
  const questions: Record<string, { type: "noul"; instructions: string }> = {};
  for (const [key, description] of Object.entries(POLICIES)) {
    questions[key] = {
      type: "noul",
      instructions: `Does this ${noun} contain ${description}? Consider the text${imageUrl ? " and the linked image" : ""}.`,
    };
  }
  return { body: { model: MODEL, state, questions } };
}

function record(x: unknown): Record<string, any> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Invalid Jev response");
  return x as Record<string, any>;
}

function confidence(x: unknown): number {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1) throw new Error("Invalid Jev response");
  return x;
}

export function interpretModeration(raw: unknown): ModerationJudgment {
  const response = record(raw);
  const answers = record(response.answers);
  if (response.model !== MODEL) throw new Error("Unexpected Jev model");
  const reasons: string[] = [];
  let verdict: ModerationVerdict = "allow";
  for (const key of Object.keys(POLICIES)) {
    const a = record(answers[key]);
    if (a.type !== "noul") throw new Error("Invalid Jev response");
    const score = confidence(a.noul);
    if (score >= REJECT_THRESHOLD) {
      reasons.push(key);
      verdict = "reject";
    } else if (score >= HOLD_THRESHOLD) {
      reasons.push(key);
      if (verdict !== "reject") verdict = "hold";
    }
  }
  return { verdict, reasons, model: response.model };
}
