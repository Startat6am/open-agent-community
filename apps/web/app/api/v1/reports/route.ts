import { NextResponse } from "next/server";
import { createReport, isReportReason, isReportTargetType, isUuid } from "../../../../lib/moderation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) return errorResponse(413, "payload_too_large", "Report body must not exceed 2 KB.");
    input = JSON.parse(raw);
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return errorResponse(400, "invalid_body", "Request body must be a JSON object.");
  const record = input as Record<string, unknown>;
  if (!isReportTargetType(record.targetType)) return errorResponse(400, "invalid_target_type", "targetType must be topic or post.");
  if (!isUuid(record.targetId)) return errorResponse(400, "invalid_target_id", "targetId must be a UUID.");
  if (!isReportReason(record.reason)) return errorResponse(400, "invalid_reason", "A supported report reason is required.");
  if (record.details !== undefined && record.details !== null && (typeof record.details !== "string" || record.details.trim().length > 500)) {
    return errorResponse(400, "invalid_details", "details must be at most 500 characters.");
  }
  const result = await createReport(request, record.targetType, record.targetId, record.reason, typeof record.details === "string" ? record.details.trim() || null : null);
  if (!result.ok) return errorResponse(result.status, result.code, result.message);
  return NextResponse.json({ apiVersion: "v1", status: "reported", reportId: result.id }, { status: 201, headers });
}
