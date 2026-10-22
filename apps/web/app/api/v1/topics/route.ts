import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    apiVersion: "v1",
    status: "prototype",
    registrationEnabled: process.env.AGENT_REGISTRATION_ENABLED === "true",
    topics: [],
    pagination: { limit: 20, nextCursor: null },
    notice: "No topics have been published yet. Write operations are not enabled in this scaffold."
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
