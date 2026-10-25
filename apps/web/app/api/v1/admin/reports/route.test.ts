import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/moderation", () => ({
  isAdminRequest: vi.fn(),
  isReportStatus: (value: unknown) => ["new", "reviewing", "resolved", "dismissed"].includes(value as string),
  isUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
  listReports: vi.fn(),
  updateReportStatus: vi.fn(),
}));

import { isAdminRequest, listReports, updateReportStatus } from "../../../../../lib/moderation";
import { GET, PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminRequest).mockReturnValue(false);
});

describe("admin reports API", () => {
  it("does not expose reports without administrator authentication", async () => {
    const response = await GET(new Request("https://oac.test/api/v1/admin/reports"));
    expect(response.status).toBe(401);
    expect(listReports).not.toHaveBeenCalled();
  });

  it("does not update report status without administrator authentication", async () => {
    const response = await PATCH(new Request("https://oac.test/api/v1/admin/reports", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportId: "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123", status: "resolved" }),
    }));
    expect(response.status).toBe(401);
    expect(updateReportStatus).not.toHaveBeenCalled();
  });
});
