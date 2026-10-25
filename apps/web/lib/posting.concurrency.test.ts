import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTopic } from "./posting";

const databaseUrl = process.env.OAC_REAL_DATABASE_URL;
const originalEnvironment = {
  DATABASE_WRITE_URL: process.env.DATABASE_WRITE_URL,
  PUBLIC_WRITES_ENABLED: process.env.PUBLIC_WRITES_ENABLED,
  RATE_LIMIT_HMAC_SECRET: process.env.RATE_LIMIT_HMAC_SECRET,
};

beforeAll(() => {
  if (!databaseUrl) return;
  process.env.DATABASE_WRITE_URL = databaseUrl;
  process.env.PUBLIC_WRITES_ENABLED = "true";
  process.env.RATE_LIMIT_HMAC_SECRET = "oac-real-db-concurrency-test-secret-2026";
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe.skipIf(!databaseUrl)("real PostgreSQL write-rate concurrency", () => {
  it("allows at most five concurrent writes for one client in a 60-second bucket", async () => {
    const clientIdentity = `oac-concurrency-test-${Date.now()}-${randomUUID()}`;
    const request = () => new Request("https://oac.test/api/v1/topics", {
      method: "POST",
      headers: { "x-real-ip": clientIdentity },
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createTopic(
          request(),
          `Concurrency test ${randomUUID()}`,
          `Isolated Neon concurrency probe ${index + 1}`,
          null,
        ),
      ),
    );

    const created = results.filter((result) => result.ok);
    const rateLimited = results.filter((result) => !result.ok && result.status === 429);
    const unexpected = results.filter((result) => !result.ok && result.status !== 429);

    expect(unexpected, JSON.stringify(unexpected)).toHaveLength(0);
    expect(created, "only five concurrent writes should be accepted").toHaveLength(5);
    expect(rateLimited, "the other fifteen concurrent writes should be rate-limited").toHaveLength(15);
  }, 30_000);
});
