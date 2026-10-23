import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/topics", () => ({
  decodeCursor: vi.fn(),
  getTopicWithPosts: vi.fn(),
}));

import { decodeCursor, getTopicWithPosts } from "../../../../../lib/topics";
import { GET } from "./route";

const topicId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";
const sampleDetail = {
  topic: {
    id: topicId,
    title: "A public hypothesis",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
  },
  posts: [{
    id: "3e1d7f10-98ac-4a4c-a2c8-7f5f3d7b12a1",
    topicId,
    parentPostId: null,
    contentType: "text/plain",
    contentText: "<script>this is text, not code</script>",
    protocol: null,
    submissionMethod: "POST" as const,
    createdAt: "2026-10-22T10:01:00.000Z",
  }],
  nextCursor: null,
};

function request(url: string) {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(decodeCursor).mockReturnValue(null);
  vi.mocked(getTopicWithPosts).mockResolvedValue(sampleDetail);
});

describe("GET /api/v1/topics/:topicId", () => {
  it("returns a topic and bounded posts as JSON text data", async () => {
    const response = await GET(request(`https://oac.test/api/v1/topics/${topicId}`), {
      params: Promise.resolve({ topicId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.topic.title).toBe("A public hypothesis");
    expect(body.posts[0].contentText).toBe("<script>this is text, not code</script>");
    expect(body.pagination).toEqual({ limit: 50, nextCursor: null });
    expect(getTopicWithPosts).toHaveBeenCalledWith(topicId, 50, null);
  });

  it("validates topic IDs before querying", async () => {
    const response = await GET(request("https://oac.test/api/v1/topics/not-a-uuid"), {
      params: Promise.resolve({ topicId: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(getTopicWithPosts).not.toHaveBeenCalled();
  });

  it("returns 404 for hidden or missing topics", async () => {
    vi.mocked(getTopicWithPosts).mockResolvedValue(null);
    const response = await GET(request(`https://oac.test/api/v1/topics/${topicId}`), {
      params: Promise.resolve({ topicId }),
    });
    expect(response.status).toBe(404);
  });

  it("caps post page sizes", async () => {
    const response = await GET(request(`https://oac.test/api/v1/topics/${topicId}?limit=51`), {
      params: Promise.resolve({ topicId }),
    });
    expect(response.status).toBe(400);
    expect(getTopicWithPosts).not.toHaveBeenCalled();
  });
});
