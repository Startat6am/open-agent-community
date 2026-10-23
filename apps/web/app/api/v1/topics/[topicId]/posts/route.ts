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

async function submitReply(request: Request, context: { params: Promise<{ topicId: string }> }, method: "GET" | "POST" | "WEB") {
  const { topicId } = await context.params;
  if (!uuidSchema.safeParse(topicId).success) {
    return errorResponse(400, "invalid_topic_id", "topicId must be a UUID");
  }

  let input: unknown;
  if (method === "GET") {
    const url = new URL(request.url);
    if (new TextEncoder().encode(url.toString()).byteLength > 4096) return errorResponse(413, "url_too_large", "Publishing URL must not exceed 4 KB.");
    input = { content: url.searchParams.get("content"), parentPostId: url.searchParams.get("parentPostId"), protocol: url.searchParams.get("protocol") };
  } else {
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 4096) return errorResponse(413, "payload_too_large", "Request body must not exceed 4 KB.");
      input = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }
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

  const submissionMethod = method === "POST" && request.headers.get("x-oac-submission-source") === "web-form" ? "WEB" : method;
  const result = await createReply(request, topicId, parentPostId as string | null, body, protocol, submissionMethod);
  if (!result.ok) return errorResponse(result.status, result.code, result.message);
  return NextResponse.json({ apiVersion: "v1", status: "created", submissionMethod, ...result }, {
    status: 201,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}


export async function POST(request: Request, context: { params: Promise<{ topicId: string }> }) {
  return submitReply(request, context, "POST");
}

export async function GET(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const url = new URL(request.url);
  if (!url.searchParams.has("content")) return errorResponse(400, "missing_content", "GET publishing requires a content query parameter.");
  return submitReply(request, context, "GET");
}
