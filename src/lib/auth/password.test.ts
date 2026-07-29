import { describe, expect, it } from "vitest";
import { generateTempPassword, validatePasswordStrength } from "./password";

describe("generateTempPassword", () => {
  it("is at least 12 chars and contains all four character classes", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword();
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("never repeats across generations", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(seen.size).toBe(200);
  });

  it("enforces a 12-char floor even when asked for less", () => {
    expect(generateTempPassword(4).length).toBeGreaterThanOrEqual(12);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("Str0ng!Enough#Pw")).toBeNull();
  });
  it.each([
    ["short", "Sh0rt!x"],
    ["no uppercase", "alllower1234!x"],
    ["no lowercase", "ALLUPPER1234!X"],
    ["no digit", "NoDigitsHere!!aB"],
    ["no special", "NoSpecials1234aB"],
  ])("rejects %s", (_label, pw) => {
    expect(validatePasswordStrength(pw)).not.toBeNull();
  });
});
