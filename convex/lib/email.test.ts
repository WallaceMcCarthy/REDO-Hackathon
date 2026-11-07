import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("email rules", () => {
  it("gives every spelling of a mailbox one form", () => {
    expect(normalizeEmail("  Qa-X@Example.Test ")).toBe("qa-x@example.test");
  });

  it("accepts real addresses and rejects the rest", () => {
    expect(isValidEmail("qa+tag@example.co.uk")).toBe(true);
    for (const bad of ["notanemail-x", "a@b", "a b@example.test", "@example.test", "a@@example.test", `${"a".repeat(250)}@b.co`]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});
