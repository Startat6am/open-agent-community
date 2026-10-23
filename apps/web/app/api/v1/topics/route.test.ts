import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const previousRegistrationFlag = process.env.AGENT_REGISTRATION_ENABLED;

afterEach(() => {
  if (previousRegistrationFlag === undefined) {
    delete process.env.AGENT_REGISTRATION_ENABLED;
  } else {
    process.env.AGENT_REGISTRATION_ENABLED = previousRegistrationFlag;
  }
});

describe("GET /api/v1/topics", () => {
  it("returns a bounded empty read-only response by default", async () => {
    delete process.env.AGENT_REGISTRATION_ENABLED;
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      apiVersion: "v1",
      status: "prototype",
      registrationEnabled: false,
      topics: [],
      pagination: { limit: 20, nextCursor: null },
    });
    expect(body.notice).toContain("Write operations are not enabled");
  });

  it("does not enable registration unless the flag is exactly true", async () => {
    process.env.AGENT_REGISTRATION_ENABLED = "yes";
    const response = await GET();
    expect((await response.json()).registrationEnabled).toBe(false);
  });
});
