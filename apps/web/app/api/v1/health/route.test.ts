import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/topics", () => ({
  listTopics: vi.fn(),
}));

import { listTopics } from "../../../../lib/topics";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTopics).mockResolvedValue({ topics: [], nextCursor: null });
});

describe("GET /api/v1/health", () => {
  it("checks database reachability and returns a non-cached health response", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "oac-web",
      mode: "database",
      database: "reachable",
    });
    expect(listTopics).toHaveBeenCalledWith(1, null);
  });

  it("returns a safe 503 when the database is unavailable", async () => {
    vi.mocked(listTopics).mockRejectedValueOnce(new Error("offline"));
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      service: "oac-web",
      mode: "database",
      database: "unavailable",
    });
  });
});
