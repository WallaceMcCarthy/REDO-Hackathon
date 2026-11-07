import { describe, expect, it } from "vitest";
import { moderationRequest, interpretModeration } from "./moderation";

const POLICY_KEYS = [
  "hate_or_harassment", "fair_housing", "sexual_content", "violence_or_illegal",
  "scam_or_phishing", "spam", "contact_info_leak",
];

function reply(scores: Partial<Record<string, number>> = {}) {
  return {
    model: "jev-1.14.0",
    answers: Object.fromEntries(POLICY_KEYS.map((key) => [key, { type: "noul", noul: scores[key] ?? 0.01 }])),
  };
}

describe("moderationRequest", () => {
  it("asks one noul question per policy and includes the trimmed content", () => {
    const { body } = moderationRequest("comment", "  Nice place!  ");
    expect(body.model).toBe("jev-1.14.0");
    expect(body.state).toEqual({ kind: "comment", content: "Nice place!" });
    expect(Object.keys(body.questions)).toHaveLength(POLICY_KEYS.length);
    for (const q of Object.values(body.questions)) expect(q).toMatchObject({ type: "noul" });
  });

  it("includes the image url in state when given, and mentions it in the question text", () => {
    const { body } = moderationRequest("ad", "Great house", "https://example.test/a.jpg");
    expect(body.state.imageUrl).toBe("https://example.test/a.jpg");
    expect(Object.values(body.questions).some((q: any) => q.instructions.includes("linked image"))).toBe(true);
  });

  it("bounds content length sent to the provider", () => {
    const { body } = moderationRequest("comment", "x".repeat(10_000));
    expect((body.state.content as string).length).toBe(4000);
  });
});

describe("interpretModeration", () => {
  it("allows content with no policy signal", () => {
    expect(interpretModeration(reply())).toEqual({ verdict: "allow", reasons: [], model: "jev-1.14.0" });
  });

  it("holds content with a moderate signal", () => {
    const result = interpretModeration(reply({ spam: 0.6 }));
    expect(result.verdict).toBe("hold");
    expect(result.reasons).toEqual(["spam"]);
  });

  it("rejects content with a strong signal, even alongside a moderate one", () => {
    const result = interpretModeration(reply({ spam: 0.6, hate_or_harassment: 0.9 }));
    expect(result.verdict).toBe("reject");
    expect(result.reasons.sort()).toEqual(["hate_or_harassment", "spam"].sort());
  });

  it("rejects wins over hold regardless of question order", () => {
    const result = interpretModeration(reply({ hate_or_harassment: 0.9, contact_info_leak: 0.55 }));
    expect(result.verdict).toBe("reject");
  });

  it("throws on a malformed or wrong-model response rather than guessing a verdict", () => {
    expect(() => interpretModeration({ model: "jev-1.14.0", answers: {} })).toThrow("Invalid Jev response");
    expect(() => interpretModeration({ model: "other-model", answers: reply().answers })).toThrow("Unexpected Jev model");
    expect(() => interpretModeration(null)).toThrow("Invalid Jev response");
  });
});
