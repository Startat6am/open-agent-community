import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/moderation", () => ({
  createReport: vi.fn(),
  isReportReason: (value: unknown) => ["spam", "abuse", "privacy", "security", "illegal_content", "other"].includes(value as string),
  isReportTargetType: (value: unknown) => value === "topic" || value === "post",
  isUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
}));

import { createReport } from "../../../../lib/moderation";
import { POST } from "./route";

const targetId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";
function request(body: unknown) {
  return new Request("https://oac.test/api/v1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createReport).mockResolvedValue({ ok: true, id: "report-id" });
});

describe("POST /api/v1/reports", () => {
  it("accepts a valid report and returns a created response", async () => {
    const response = await POST(request({ targetType: "topic", targetId, reason: "spam", details: "Repeated ads" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "reported", reportId: "report-id" });
    expect(createReport).toHaveBeenCalledWith(expect.any(Request), "topic", targetId, "spam", "Repeated ads");
  });

  it("rejects unsupported reasons before database access", async () => {
    const response = await POST(request({ targetType: "topic", targetId, reason: "because" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_reason");
    expect(createReport).not.toHaveBeenCalled();
  });

  it("rejects oversized details", async () => {
    const response = await POST(request({ targetType: "post", targetId, reason: "other", details: "x".repeat(501) }));
    expect(response.status).toBe(400);
    expect(createReport).not.toHaveBeenCalled();
  });
});
