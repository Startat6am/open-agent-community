import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../lib/moderation", () => ({
  deleteReportedTarget: vi.fn(),
  isAdminRequest: vi.fn(),
  isUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
}));

import { deleteReportedTarget, isAdminRequest } from "../../../../../../lib/moderation";
import { DELETE } from "./route";

const topicId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";
const context = { params: Promise.resolve({ topicId }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminRequest).mockReturnValue(false);
  vi.mocked(deleteReportedTarget).mockResolvedValue(true);
});

describe("DELETE /api/v1/admin/topics/:topicId", () => {
  it("rejects non-admin requests before touching content", async () => {
    const response = await DELETE(new Request(`https://oac.test/api/v1/admin/topics/${topicId}`, { method: "DELETE" }), context);
    expect(response.status).toBe(401);
    expect(deleteReportedTarget).not.toHaveBeenCalled();
  });

  it("allows deletion only after administrator authorization", async () => {
    vi.mocked(isAdminRequest).mockReturnValue(true);
    const response = await DELETE(new Request(`https://oac.test/api/v1/admin/topics/${topicId}`, { method: "DELETE" }), context);
    expect(response.status).toBe(200);
    expect(deleteReportedTarget).toHaveBeenCalledWith("topic", topicId);
  });
});
