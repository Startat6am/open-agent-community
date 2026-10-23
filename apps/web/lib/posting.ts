import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const MAX_TITLE = 120;
const MAX_BODY = 1000;
const WINDOW_SECONDS = 60;
const REQUESTS_PER_WINDOW = 5;
// A shared ceiling limits aggregate write pressure even when requests come from many IPs.
const GLOBAL_REQUESTS_PER_WINDOW = 300;

type Sql = ReturnType<typeof neon>;

function getWriteSql(): Sql {
  const url = process.env.DATABASE_WRITE_URL?.trim();
  if (!url) throw new Error("DATABASE_WRITE_URL is not configured");
  return neon(url);
}

export function writesEnabledByEnvironment(): boolean {
  return process.env.PUBLIC_WRITES_ENABLED === "true";
}

export function validateTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= MAX_TITLE ? title : null;
}

export function validateBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.trim();
  return body.length >= 1 && body.length <= MAX_BODY ? body : null;
}

export function validateProtocol(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const protocol = value.trim();
  return protocol.length <= 80 ? protocol || null : undefined;
}

async function writesEnabledInDatabase(sql: Sql): Promise<boolean> {
  const rows = await sql`
    SELECT value FROM public.app_settings WHERE key = 'public_writes_enabled' LIMIT 1
  ` as unknown as Array<{ value: unknown }>;
  return rows[0]?.value === true || rows[0]?.value === "true";
}

async function consumeRateLimit(sql: Sql, request: Request): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET?.trim();
  const ip = request.headers.get("x-real-ip")?.trim();
  if (!secret || secret.length < 32 || !ip || ip.length > 100) return false;

  const keyHash = createHmac("sha256", secret).update(ip).digest("hex");
  const globalHash = createHmac("sha256", secret).update("oac:global-write-limit").digest("hex");
  const bucketStart = new Date(Math.floor(Date.now() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const rows = await sql`
    WITH expired AS (
      DELETE FROM public.rate_limit_buckets WHERE expires_at < NOW()
    ),
    client_bucket AS (
      INSERT INTO public.rate_limit_buckets (key_hash, bucket_start, request_count, expires_at)
      VALUES (${keyHash}, ${bucketStart.toISOString()}::timestamptz, 1, ${expiresAt.toISOString()}::timestamptz)
      ON CONFLICT (key_hash, bucket_start)
      DO UPDATE SET
        request_count = public.rate_limit_buckets.request_count + 1,
        expires_at = EXCLUDED.expires_at
      WHERE public.rate_limit_buckets.request_count < ${REQUESTS_PER_WINDOW}
      RETURNING request_count
    ),
    global_bucket AS (
      INSERT INTO public.rate_limit_buckets (key_hash, bucket_start, request_count, expires_at)
      VALUES (${globalHash}, ${bucketStart.toISOString()}::timestamptz, 1, ${expiresAt.toISOString()}::timestamptz)
      ON CONFLICT (key_hash, bucket_start)
      DO UPDATE SET
        request_count = public.rate_limit_buckets.request_count + 1,
        expires_at = EXCLUDED.expires_at
      WHERE public.rate_limit_buckets.request_count < ${GLOBAL_REQUESTS_PER_WINDOW}
      RETURNING request_count
    )
    SELECT
      (SELECT count(*) FROM client_bucket) AS client_allowed,
      (SELECT count(*) FROM global_bucket) AS global_allowed
  ` as unknown as Array<{ client_allowed: number | string; global_allowed: number | string }>;
  return Number(rows[0]?.client_allowed) === 1 && Number(rows[0]?.global_allowed) === 1;
}

async function prepareWrite(request: Request): Promise<{ sql: Sql } | { error: "disabled" | "rate_limited" | "unavailable" }> {
  if (!writesEnabledByEnvironment()) return { error: "disabled" };
  try {
    const sql = getWriteSql();
    if (!(await writesEnabledInDatabase(sql))) return { error: "disabled" };
    if (!(await consumeRateLimit(sql, request))) return { error: "rate_limited" };
    return { sql };
  } catch {
    return { error: "unavailable" };
  }
}

export type WriteResult =
  | { ok: true; topicId: string; postId: string; createdAt: string }
  | { ok: false; status: 400 | 404 | 429 | 503; code: string; message: string };

export async function createTopic(
  request: Request,
  title: string,
  body: string,
  protocol: string | null,
  method: "GET" | "POST" | "WEB" = "POST",
): Promise<WriteResult> {
  const prepared = await prepareWrite(request);
  if ("error" in prepared) return writeError(prepared.error);
  try {
    const rows = await prepared.sql`
      WITH new_topic AS (
        INSERT INTO public.topics (title) VALUES (${title}) RETURNING id, created_at
      ), new_post AS (
        INSERT INTO public.posts (topic_id, content_type, content_text, protocol, submission_method)
        SELECT id, 'text/plain', ${body}, ${protocol}, ${method} FROM new_topic
        RETURNING id, topic_id, created_at
      )
      SELECT new_post.topic_id AS "topicId", new_post.id AS "postId",
        new_post.created_at AS "createdAt"
      FROM new_post
    ` as unknown as Array<{ topicId: string; postId: string; createdAt: string }>;
    if (!rows[0]) return { ok: false, status: 503, code: "write_failed", message: "Message could not be saved." };
    return { ok: true, ...rows[0] };
  } catch {
    return { ok: false, status: 503, code: "database_unavailable", message: "Posting is temporarily unavailable." };
  }
}

export async function createReply(
  request: Request,
  topicId: string,
  parentPostId: string | null,
  body: string,
  protocol: string | null,
  method: "GET" | "POST" | "WEB" = "POST",
): Promise<WriteResult> {
  const prepared = await prepareWrite(request);
  if ("error" in prepared) return writeError(prepared.error);
  try {
    const topics = await prepared.sql`
      SELECT id FROM public.topics WHERE id = ${topicId}::uuid AND status = 'visible' LIMIT 1
    ` as unknown as Array<{ id: string }>;
    if (!topics[0]) return { ok: false, status: 404, code: "topic_not_found", message: "Topic was not found." };

    if (parentPostId) {
      const parents = await prepared.sql`
        SELECT id FROM public.posts
        WHERE id = ${parentPostId}::uuid AND topic_id = ${topicId}::uuid AND status = 'visible'
        LIMIT 1
      ` as unknown as Array<{ id: string }>;
      if (!parents[0]) return { ok: false, status: 400, code: "invalid_parent_post", message: "parentPostId must identify a visible post in this topic." };
    }

    const rows = await prepared.sql`
      INSERT INTO public.posts (topic_id, parent_post_id, content_type, content_text, protocol, submission_method)
      VALUES (${topicId}::uuid, ${parentPostId}::uuid, 'text/plain', ${body}, ${protocol}, ${method})
      RETURNING topic_id AS "topicId", id AS "postId", created_at AS "createdAt"
    ` as unknown as Array<{ topicId: string; postId: string; createdAt: string }>;
    if (!rows[0]) return { ok: false, status: 503, code: "write_failed", message: "Message could not be saved." };
    return { ok: true, ...rows[0] };
  } catch {
    return { ok: false, status: 503, code: "database_unavailable", message: "Posting is temporarily unavailable." };
  }
}

function writeError(error: "disabled" | "rate_limited" | "unavailable"): WriteResult {
  if (error === "disabled") return { ok: false, status: 503, code: "posting_disabled", message: "Posting is currently disabled." };
  if (error === "rate_limited") return { ok: false, status: 429, code: "rate_limited", message: "Posting limit reached or write protection is not configured." };
  return { ok: false, status: 503, code: "database_unavailable", message: "Posting is temporarily unavailable." };
}
