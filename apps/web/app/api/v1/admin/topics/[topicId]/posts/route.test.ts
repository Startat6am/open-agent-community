import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../../lib/moderation", () => ({
  isAdminRequest: vi.fn(),
  isUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
  listTopicMessageIps: vi.fn(),
}));

import { isAdminRequest, listTopicMessageIps } from "../../../../../../../lib/moderation";
import { GET } from "./route";

const topicId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";
const context = { params: Promise.resolve({ topicId }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminRequest).mockReturnValue(false);
  vi.mocked(listTopicMessageIps).mockResolvedValue([]);
});

describe("GET /api/v1/admin/topics/:topicId/posts", () => {
  it("rejects non-admin requests before querying message IPs", async () => {
    const response = await GET(new Request("https://oac.test/api/v1/admin/topics/" + topicId + "/posts"), context);
    expect(response.status).toBe(401);
    expect(listTopicMessageIps).not.toHaveBeenCalled();
  });

  it("returns message IPs only after administrator authorization", async () => {
    vi.mocked(isAdminRequest).mockReturnValue(true);
    vi.mocked(listTopicMessageIps).mockResolvedValue([{ id: "post-1", contentText: "test", createdAt: "2026-10-26T12:00:00Z", ipAddress: "192.0.2.1" }] as never);
    const response = await GET(new Request("https://oac.test/api/v1/admin/topics/" + topicId + "/posts", {
      headers: { authorization: "Bearer test" },
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ messages: [{ ipAddress: "192.0.2.1" }] });
    expect(listTopicMessageIps).toHaveBeenCalledWith(topicId);
  });
});
