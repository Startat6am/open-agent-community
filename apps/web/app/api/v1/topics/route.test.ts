import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/topics", () => ({
  decodeCursor: vi.fn(),
  listTopics: vi.fn(),
}));

import { decodeCursor, listTopics } from "../../../../lib/topics";
import { GET } from "./route";

const samplePage = {
  topics: [{
    id: "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123",
    title: "A public hypothesis",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    postCount: 2,
  }],
  nextCursor: "eyJpZCI6ImN1cnNvciJ9",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(decodeCursor).mockReturnValue(null);
  vi.mocked(listTopics).mockResolvedValue(samplePage);
});

describe("GET /api/v1/topics", () => {
  it("returns a bounded public topic page and keeps writes disabled", async () => {
    const response = await GET(new Request("https://oac.test/api/v1/topics"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      apiVersion: "v1",
      status: "ok",
      registrationEnabled: false,
      topics: samplePage.topics,
      pagination: { limit: 20, nextCursor: samplePage.nextCursor },
    });
    expect(listTopics).toHaveBeenCalledWith(20, null);
  });

  it("rejects unbounded or malformed limits", async () => {
    const response = await GET(new Request("https://oac.test/api/v1/topics?limit=1000"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_limit");
    expect(listTopics).not.toHaveBeenCalled();
  });

  it("rejects an invalid cursor", async () => {
    const response = await GET(new Request("https://oac.test/api/v1/topics?cursor=bad"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_cursor");
    expect(listTopics).not.toHaveBeenCalled();
  });

  it("returns a generic unavailable response when the database cannot be read", async () => {
    vi.mocked(listTopics).mockRejectedValue(new Error("connection details must not leak"));
    const response = await GET(new Request("https://oac.test/api/v1/topics"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("connection details");
  });
});
