import { NextResponse } from "next/server";
import { isAdminRequest, isReportStatus, isUuid, listReports, updateReportStatus } from "../../../../../lib/moderation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return errorResponse(401, "admin_unauthorized", "Administrator authentication is required.");
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  if (rawStatus !== null && !isReportStatus(rawStatus)) return errorResponse(400, "invalid_status", "status is invalid.");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return errorResponse(400, "invalid_limit", "limit must be an integer between 1 and 100.");
  try {
    const reports = await listReports(rawStatus, limit);
    return NextResponse.json({ apiVersion: "v1", reports }, { headers });
  } catch {
    return errorResponse(503, "database_unavailable", "Reports are temporarily unavailable.");
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return errorResponse(401, "admin_unauthorized", "Administrator authentication is required.");
  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1024) return errorResponse(413, "payload_too_large", "Request body must not exceed 1 KB.");
    input = JSON.parse(raw);
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return errorResponse(400, "invalid_body", "Request body must be a JSON object.");
  const record = input as Record<string, unknown>;
  if (!isUuid(record.reportId) || !isReportStatus(record.status)) return errorResponse(400, "invalid_report_update", "reportId and a supported status are required.");
  try {
    const report = await updateReportStatus(record.reportId, record.status);
    if (!report) return errorResponse(404, "report_not_found", "Report was not found.");
    return NextResponse.json({ apiVersion: "v1", report }, { headers });
  } catch {
    return errorResponse(503, "database_unavailable", "Report status could not be updated.");
  }
}
