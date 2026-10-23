import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeCursor, listTopics } from "../../../../lib/topics";

export const dynamic = "force-dynamic";

const limitSchema = z.coerce.number().int().min(1).max(50);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limitResult = limitSchema.safeParse(rawLimit === null ? 20 : rawLimit);
  if (!limitResult.success) {
    return errorResponse(400, "invalid_limit", "limit must be an integer between 1 and 50");
  }

  const token = url.searchParams.get("cursor");
  const cursor = token ? decodeCursor(token) : null;
  if (token && !cursor) {
    return errorResponse(400, "invalid_cursor", "cursor is invalid or expired");
  }

  try {
    const result = await listTopics(limitResult.data, cursor);
    return NextResponse.json({
      apiVersion: "v1",
      status: "ok",
      registrationEnabled: false,
      topics: result.topics,
      pagination: { limit: limitResult.data, nextCursor: result.nextCursor },
    }, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return errorResponse(503, "database_unavailable", "Public topics are temporarily unavailable.");
  }
}
