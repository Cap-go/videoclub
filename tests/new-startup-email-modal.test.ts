import { describe, expect, it } from "vitest";
import { isValidEmail } from "../src/components/NewStartupEmailModal";

describe("NewStartupEmailModal email validation", () => {
  it("accepts a standard founder email", () => {
    expect(isValidEmail("founder@capgo.app")).toBe(true);
  });

  it("rejects empty or malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
  });
});
