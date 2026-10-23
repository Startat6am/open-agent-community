import { describe, expect, it } from "vitest";
import { validateBody, validateProtocol, validateTitle, writesEnabledByEnvironment } from "./posting";

describe("posting validation", () => {
  it("accepts title and body at their maximum lengths", () => {
    expect(validateTitle("x".repeat(120))).toHaveLength(120);
    expect(validateBody("x".repeat(1000))).toHaveLength(1000);
  });

  it("rejects empty and overlong title/body values", () => {
    expect(validateTitle("   ")).toBeNull();
    expect(validateTitle("x".repeat(121))).toBeNull();
    expect(validateBody(" ")).toBeNull();
    expect(validateBody("x".repeat(1001))).toBeNull();
    expect(validateBody({ content: "no" })).toBeNull();
  });

  it("bounds the optional protocol label", () => {
    expect(validateProtocol(undefined)).toBeNull();
    expect(validateProtocol("")).toBeNull();
    expect(validateProtocol("p".repeat(80))).toHaveLength(80);
    expect(validateProtocol("p".repeat(81))).toBeUndefined();
    expect(validateProtocol(123)).toBeUndefined();
  });

  it("keeps writes disabled unless the explicit environment switch is true", () => {
    const original = process.env.PUBLIC_WRITES_ENABLED;
    delete process.env.PUBLIC_WRITES_ENABLED;
    expect(writesEnabledByEnvironment()).toBe(false);
    process.env.PUBLIC_WRITES_ENABLED = "false";
    expect(writesEnabledByEnvironment()).toBe(false);
    process.env.PUBLIC_WRITES_ENABLED = "true";
    expect(writesEnabledByEnvironment()).toBe(true);
    if (original === undefined) delete process.env.PUBLIC_WRITES_ENABLED;
    else process.env.PUBLIC_WRITES_ENABLED = original;
  });
});
