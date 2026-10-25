import { NextResponse } from "next/server";
import { deleteReportedTarget, isAdminRequest, isUuid } from "../../../../../../lib/moderation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!isAdminRequest(request)) return errorResponse(401, "admin_unauthorized", "Administrator authentication is required.");
  const { postId } = await context.params;
  if (!isUuid(postId)) return errorResponse(400, "invalid_post_id", "postId must be a UUID.");
  try {
    const deleted = await deleteReportedTarget("post", postId);
    if (!deleted) return errorResponse(404, "post_not_found", "Post was not found.");
    return NextResponse.json({ apiVersion: "v1", status: "deleted", postId }, { headers });
  } catch {
    return errorResponse(503, "database_unavailable", "Post could not be deleted.");
  }
}
