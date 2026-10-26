import { afterEach, describe, expect, it } from "vitest";
import { isAdminRequest, isReportReason, isReportStatus, isReportTargetType, isUuid } from "./moderation";

afterEach(() => {
  delete process.env.OAC_ADMIN_TOKEN;
});

describe("moderation validation and authorization", () => {
  it("accepts only supported report values", () => {
    expect(isReportTargetType("topic")).toBe(true);
    expect(isReportTargetType("user")).toBe(false);
    expect(isReportReason("privacy")).toBe(true);
    expect(isReportReason("made_up_reason")).toBe(false);
    expect(isReportStatus("resolved")).toBe(true);
    expect(isReportStatus("deleted")).toBe(false);
    expect(isUuid("8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("fails closed when the admin secret is missing or too short", () => {
    const request = new Request("https://oac.test/api/v1/admin/reports", { headers: { authorization: "Bearer a" } });
    expect(isAdminRequest(request)).toBe(false);
    process.env.OAC_ADMIN_TOKEN = "short";
    expect(isAdminRequest(request)).toBe(false);
  });

  it("requires a matching bearer token of at least 32 characters", () => {
    const token = "test-admin-token-that-is-longer-than-32-characters";
    process.env.OAC_ADMIN_TOKEN = token;
    expect(isAdminRequest(new Request("https://oac.test/admin"))).toBe(false);
    expect(isAdminRequest(new Request("https://oac.test/admin", { headers: { authorization: "Bearer wrong-token-long-enough-to-compare" } }))).toBe(false);
    expect(isAdminRequest(new Request("https://oac.test/admin", { headers: { authorization: `Bearer ${token}` } }))).toBe(true);
  });
});
