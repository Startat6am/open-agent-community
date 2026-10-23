import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeCursor, getTopicWithPosts } from "../../../../../lib/topics";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();
const limitSchema = z.coerce.number().int().min(1).max(50);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await context.params;
  if (!uuidSchema.safeParse(topicId).success) {
    return errorResponse(400, "invalid_topic_id", "topicId must be a UUID");
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limitResult = limitSchema.safeParse(rawLimit === null ? 50 : rawLimit);
  if (!limitResult.success) {
    return errorResponse(400, "invalid_limit", "limit must be an integer between 1 and 50");
  }

  const token = url.searchParams.get("cursor");
  const cursor = token ? decodeCursor(token) : null;
  if (token && !cursor) {
    return errorResponse(400, "invalid_cursor", "cursor is invalid or expired");
  }

  try {
    const result = await getTopicWithPosts(topicId, limitResult.data, cursor);
    if (!result) return errorResponse(404, "topic_not_found", "Topic was not found.");
    return NextResponse.json({
      apiVersion: "v1",
      topic: result.topic,
      posts: result.posts,
      pagination: { limit: limitResult.data, nextCursor: result.nextCursor },
    }, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return errorResponse(503, "database_unavailable", "Topic details are temporarily unavailable.");
  }
}
