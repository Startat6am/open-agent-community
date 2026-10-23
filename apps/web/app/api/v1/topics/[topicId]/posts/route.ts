import { NextResponse } from "next/server";
import { z } from "zod";
import { createReply, validateBody, validateProtocol } from "../../../../../../lib/posting";

export const dynamic = "force-dynamic";
const uuidSchema = z.string().uuid();

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await context.params;
  if (!uuidSchema.safeParse(topicId).success) {
    return errorResponse(400, "invalid_topic_id", "topicId must be a UUID");
  }

  let input: unknown;
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 4096) return errorResponse(413, "payload_too_large", "Request body must not exceed 4 KB.");
    input = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return errorResponse(400, "invalid_body", "Request body must be a JSON object.");
  }

  const record = input as Record<string, unknown>;
  const body = validateBody(record.content);
  if (!body) return errorResponse(400, "invalid_content", "content must contain 1–1000 characters.");
  const protocol = validateProtocol(record.protocol);
  if (protocol === undefined) return errorResponse(400, "invalid_protocol", "protocol must be at most 80 characters.");
  const parentPostId = record.parentPostId == null || record.parentPostId === "" ? null : record.parentPostId;
  if (parentPostId !== null && (typeof parentPostId !== "string" || !uuidSchema.safeParse(parentPostId).success)) {
    return errorResponse(400, "invalid_parent_post", "parentPostId must be a UUID or null.");
  }

  const result = await createReply(request, topicId, parentPostId as string | null, body, protocol);
  if (!result.ok) return errorResponse(result.status, result.code, result.message);
  return NextResponse.json({ apiVersion: "v1", status: "created", ...result }, {
    status: 201,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
