import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => sqlMock),
}));

import { createReply, createTopic } from "./posting";

const topicId = "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123";
const postId = "1b9c4d22-7a6e-4e8d-a41d-56c9e3c8c456";
const createdAt = "2026-10-25T10:00:00.000Z";
const request = () => new Request("https://example.test/api/v1/topics", {
  method: "POST",
  headers: { "x-real-ip": "203.0.113.10" },
});

function queryText(strings: TemplateStringsArray): string {
  return strings.join("?");
}

function enableWrites(): void {
  process.env.PUBLIC_WRITES_ENABLED = "true";
  process.env.DATABASE_WRITE_URL = "postgresql://test.invalid/oac";
  process.env.RATE_LIMIT_HMAC_SECRET = "test-secret-that-is-at-least-32-characters";
}

beforeEach(() => {
  sqlMock.mockReset();
  enableWrites();
});

afterEach(() => {
  delete process.env.PUBLIC_WRITES_ENABLED;
  delete process.env.DATABASE_WRITE_URL;
  delete process.env.RATE_LIMIT_HMAC_SECRET;
});

describe("write flow and database-backed rate limiting", () => {
  it("creates a topic only after both write gates and the rate limit allow it", async () => {
    const statements: string[] = [];
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = queryText(strings);
      statements.push(sql);
      if (sql.includes("app_settings")) return [{ value: true }];
      if (sql.includes("client_bucket")) return [{ client_allowed: 1, global_allowed: 1 }];
      if (sql.includes("new_topic")) return [{ topicId, postId, createdAt }];
      throw new Error("Unexpected SQL statement");
    });

    await expect(createTopic(request(), "Test topic", "Test body", null)).resolves.toEqual({
      ok: true,
      topicId,
      postId,
      createdAt,
    });

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("public_writes_enabled");
    expect(statements[1]).toContain("client_bucket");
    expect(statements[1]).toContain("global_bucket");
    expect(statements[1]).toContain("ON CONFLICT");
    expect(statements[2]).toContain("INSERT INTO public.topics");
    expect(statements[2]).toContain("INSERT INTO public.posts");
  });

  it("does not attempt a write when the database-level switch is disabled", async () => {
    sqlMock.mockResolvedValue([{ value: false }]);

    await expect(createTopic(request(), "Test topic", "Test body", null)).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: "posting_disabled",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 and does not write when the client bucket is exhausted", async () => {
    const statements: string[] = [];
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = queryText(strings);
      statements.push(sql);
      if (sql.includes("app_settings")) return [{ value: true }];
      if (sql.includes("client_bucket")) return [{ client_allowed: 0, global_allowed: 0 }];
      throw new Error("Write query should not run after rate limiting");
    });

    await expect(createTopic(request(), "Test topic", "Test body", null)).resolves.toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
    expect(statements).toHaveLength(2);
    expect(statements.some((sql) => sql.includes("INSERT INTO public.topics"))).toBe(false);
  });

  it("fails closed with 429 when rate-limit identity or secret is missing", async () => {
    sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
      if (queryText(strings).includes("app_settings")) return [{ value: true }];
      throw new Error("Rate-limit SQL must not run without a trusted identity");
    });
    const noIpRequest = new Request("https://example.test/api/v1/topics", { method: "POST" });

    await expect(createTopic(noIpRequest, "Test topic", "Test body", null)).resolves.toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns a controlled unavailable response when the settings query fails", async () => {
    sqlMock.mockRejectedValue(new Error("database unavailable"));

    await expect(createReply(request(), topicId, null, "Reply body", null)).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: "database_unavailable",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});
