import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const REPORT_REASONS = ["spam", "abuse", "privacy", "security", "illegal_content", "other"] as const;
const REPORT_STATUSES = ["new", "reviewing", "resolved", "dismissed"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportTargetType = "topic" | "post";

type Sql = ReturnType<typeof neon>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getWriteSql(): Sql {
  const url = process.env.DATABASE_WRITE_URL?.trim();
  if (!url) throw new Error("DATABASE_WRITE_URL is not configured");
  return neon(url);
}

function getAdminSql(): Sql {
  const url = process.env.DATABASE_ADMIN_URL?.trim();
  if (!url) throw new Error("DATABASE_ADMIN_URL is not configured");
  return neon(url);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return value === "topic" || value === "post";
}

export function isAdminRequest(request: Request): boolean {
  const expected = process.env.OAC_ADMIN_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || expected.length < 8 || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function createReport(
  request: Request,
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details: string | null,
): Promise<{ ok: true; id: string } | { ok: false; status: 404 | 429 | 503; code: string; message: string }> {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET?.trim();
  const ip = request.headers.get("x-real-ip")?.trim();
  if (!secret || secret.length < 32 || !ip || ip.length > 100) {
    return { ok: false, status: 429, code: "rate_limit_unavailable", message: "Report submission protection is not configured." };
  }
  const reporterHash = createHmac("sha256", secret).update(`oac:reporter:${ip}`).digest("hex");
  const rateLimitHash = createHmac("sha256", secret).update(`oac:report-limit:${ip}`).digest("hex");
  const bucketStart = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  try {
    const sql = getWriteSql();
    const allowed = await sql`
      INSERT INTO public.rate_limit_buckets (key_hash, bucket_start, request_count, expires_at)
      VALUES (${rateLimitHash}, ${bucketStart}::timestamptz, 1, ${expiresAt}::timestamptz)
      ON CONFLICT (key_hash, bucket_start)
      DO UPDATE SET request_count = public.rate_limit_buckets.request_count + 1, expires_at = EXCLUDED.expires_at
      WHERE public.rate_limit_buckets.request_count < 3
      RETURNING request_count
    `;
    if (!(allowed as unknown as Array<{ request_count: number }>).length) return { ok: false, status: 429, code: "rate_limited", message: "Please wait before submitting another report." };

    const target = targetType === "topic"
      ? await sql`SELECT id FROM public.topics WHERE id = ${targetId}::uuid AND status = 'visible' LIMIT 1`
      : await sql`SELECT id FROM public.posts WHERE id = ${targetId}::uuid AND status = 'visible' LIMIT 1`;
    if (!(target as unknown as Array<{ id: string }>).length) return { ok: false, status: 404, code: "target_not_found", message: "The reported item was not found." };

    const rows = await sql`
      INSERT INTO public.reports (target_type, target_id, reason, details, reporter_key_hash)
      VALUES (${targetType}, ${targetId}::uuid, ${reason}, ${details}, ${reporterHash})
      RETURNING id
    ` as unknown as Array<{ id: string }>;
    if (!rows[0]) return { ok: false, status: 503, code: "report_failed", message: "The report could not be saved." };
    return { ok: true, id: rows[0].id };
  } catch {
    return { ok: false, status: 503, code: "database_unavailable", message: "Reporting is temporarily unavailable." };
  }
}

export async function listReports(status: ReportStatus | null, limit: number) {
  const sql = getAdminSql();
  return await sql`
    SELECT r.id, r.target_type AS "targetType", r.target_id AS "targetId", r.reason,
      r.details, r.status, r.created_at AS "createdAt", r.reviewed_at AS "reviewedAt"
    FROM public.reports r
    WHERE (${status}::text IS NULL OR r.status = ${status})
    ORDER BY r.created_at ASC, r.id ASC
    LIMIT ${limit}
  `;
}

export async function updateReportStatus(id: string, status: ReportStatus) {
  const sql = getAdminSql();
  const rows = await sql`
    UPDATE public.reports SET status = ${status},
      reviewed_at = CASE WHEN ${status} IN ('resolved', 'dismissed') THEN now() ELSE NULL END
    WHERE id = ${id}::uuid
    RETURNING id, status, reviewed_at AS "reviewedAt"
  ` as unknown as Array<{ id: string; status: ReportStatus; reviewedAt: string | null }>;
  return rows[0] ?? null;
}

export async function deleteReportedTarget(targetType: ReportTargetType, targetId: string) {
  const sql = getAdminSql();
  if (targetType === "topic") {
    const rows = await sql`DELETE FROM public.topics WHERE id = ${targetId}::uuid RETURNING id` as unknown as Array<{ id: string }>;
    return rows.length > 0;
  }
  const rows = await sql`DELETE FROM public.posts WHERE id = ${targetId}::uuid RETURNING id` as unknown as Array<{ id: string }>;
  return rows.length > 0;
}


export async function listTopicMessageIps(topicId: string) {
  const sql = getAdminSql();
  return await sql`
    SELECT id, content_text AS "contentText", created_at AS "createdAt",
      ip_address::text AS "ipAddress"
    FROM public.posts
    WHERE topic_id = ${topicId}::uuid
      AND created_at >= now() - interval $$30 days$$
    ORDER BY created_at ASC, id ASC
    LIMIT 100
  `;
}
