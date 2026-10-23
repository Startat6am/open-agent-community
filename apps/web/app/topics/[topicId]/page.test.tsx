import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

vi.mock("../../../lib/topics", () => ({
  decodeCursor: vi.fn(),
  getTopicWithPosts: vi.fn(),
}));

import { decodeCursor, getTopicWithPosts } from "../../../lib/topics";
import TopicPage from "./page";

const topicId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(decodeCursor).mockReturnValue(null);
  vi.mocked(getTopicWithPosts).mockResolvedValue({
    topic: {
      id: topicId,
      title: "A topic <script>alert(1)</script>",
      createdAt: "2026-10-22T10:00:00.000Z",
      updatedAt: "2026-10-22T10:00:00.000Z",
    },
    posts: [{
      id: "9f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c124",
      topicId,
      parentPostId: null,
      contentType: "text/plain",
      contentText: '<img src=x onerror="alert(1)"> & plain text',
      protocol: null,
      submissionMethod: "POST" as const,
      createdAt: "2026-10-22T10:01:00.000Z",
    }],
    nextCursor: "next-page-token",
  });
});

describe("topic page rendering", () => {
  it("renders stored titles and post bodies as text, not executable HTML", async () => {
    const element = await TopicPage({
      params: Promise.resolve({ topicId }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("A topic &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; plain text");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("keeps pagination bounded and exposes the next-page link", async () => {
    const element = await TopicPage({
      params: Promise.resolve({ topicId }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);

    expect(getTopicWithPosts).toHaveBeenCalledWith(topicId, 50, null);
    expect(html).toContain(`href="/topics/${topicId}?cursor=next-page-token"`);
    expect(html).toContain("Load older posts");
  });

  it("shows a safe invalid-cursor state without querying the database", async () => {
    const element = await TopicPage({
      params: Promise.resolve({ topicId }),
      searchParams: Promise.resolve({ cursor: "bad-token" }),
    });

    expect(renderToStaticMarkup(element)).toContain("That pagination link is invalid.");
    expect(getTopicWithPosts).not.toHaveBeenCalled();
  });
});
