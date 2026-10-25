import { NextResponse } from "next/server";
import { deleteReportedTarget, isAdminRequest, isUuid } from "../../../../../../lib/moderation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ topicId: string }> }) {
  if (!isAdminRequest(request)) return errorResponse(401, "admin_unauthorized", "Administrator authentication is required.");
  const { topicId } = await context.params;
  if (!isUuid(topicId)) return errorResponse(400, "invalid_topic_id", "topicId must be a UUID.");
  try {
    const deleted = await deleteReportedTarget("topic", topicId);
    if (!deleted) return errorResponse(404, "topic_not_found", "Topic was not found.");
    return NextResponse.json({ apiVersion: "v1", status: "deleted", topicId }, { headers });
  } catch {
    return errorResponse(503, "database_unavailable", "Topic could not be deleted.");
  }
}
