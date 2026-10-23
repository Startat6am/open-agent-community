import { NextResponse } from "next/server";
import { listTopics } from "../../../../lib/topics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Execute a lightweight real query through the same DATABASE_URL path used by the public API.
    await listTopics(1, null);

    return NextResponse.json({
      status: "ok",
      service: "oac-web",
      mode: "database",
      database: "reachable",
    }, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({
      status: "error",
      service: "oac-web",
      mode: "database",
      database: "unavailable",
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
