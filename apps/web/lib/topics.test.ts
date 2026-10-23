import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./topics";

describe("topic pagination cursors", () => {
  it("round-trips a stable timestamp and UUID", () => {
    const cursor = {
      id: "8f8a1c2e-8c1a-4c4f-9a7b-21b9e3c8c123",
      createdAt: "2026-10-22T10:00:00.000Z",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed, oversized, and invalid cursor payloads", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor("a".repeat(257))).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ id: "x", createdAt: "today" })).toString("base64url"))).toBeNull();
  });
});
