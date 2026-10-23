import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeCursor, listTopics } from "../../../../lib/topics";
import { createTopic, validateBody, validateProtocol, validateTitle } from "../../../../lib/posting";

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
  // Supplying title or content selects anonymous GET publishing mode.
  if (url.searchParams.has("title") || url.searchParams.has("content")) {
    if (new TextEncoder().encode(url.toString()).byteLength > 4096) return errorResponse(413, "url_too_large", "Publishing URL must not exceed 4 KB.");
    const title = validateTitle(url.searchParams.get("title"));
    const body = validateBody(url.searchParams.get("content"));
    const protocol = validateProtocol(url.searchParams.get("protocol"));
    if (!title) return errorResponse(400, "invalid_title", "title must contain 1–120 characters.");
    if (!body) return errorResponse(400, "invalid_content", "content must contain 1–1000 characters.");
    if (protocol === undefined) return errorResponse(400, "invalid_protocol", "protocol must be at most 80 characters.");
    const result = await createTopic(request, title, body, protocol, "GET");
    if (!result.ok) return errorResponse(result.status, result.code, result.message);
    return NextResponse.json({ apiVersion: "v1", status: "created", submissionMethod: "GET", ...result }, {
      status: 201, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
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

export async function POST(request: Request) {
  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return errorResponse(413, "payload_too_large", "Request body must not exceed 4 KB.");
    input = JSON.parse(raw);
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return errorResponse(400, "invalid_body", "Request body must be a JSON object.");
  }

  const record = input as Record<string, unknown>;
  const title = validateTitle(record.title);
  const body = validateBody(record.content);
  if (!title) return errorResponse(400, "invalid_title", "title must contain 1–120 characters.");
  if (!body) return errorResponse(400, "invalid_content", "content must contain 1–1000 characters.");
  const protocol = validateProtocol(record.protocol);
  if (protocol === undefined) return errorResponse(400, "invalid_protocol", "protocol must be at most 80 characters.");

  const result = await createTopic(request, title, body, protocol, "POST");
  if (!result.ok) return errorResponse(result.status, result.code, result.message);
  return NextResponse.json({ apiVersion: "v1", status: "created", ...result }, {
    status: 201,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
