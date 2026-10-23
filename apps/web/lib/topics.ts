import { neon } from "@neondatabase/serverless";

export type Cursor = {
  id: string;
  createdAt: string;
};

export type TopicSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  postCount: number;
};

export type TopicPost = {
  id: string;
  topicId: string;
  parentPostId: string | null;
  contentType: string;
  contentText: string;
  protocol: string | null;
  submissionMethod: "GET" | "POST" | "WEB";
  createdAt: string;
};

export type TopicWithPosts = {
  topic: Omit<TopicSummary, "postCount">;
  posts: TopicPost[];
  nextCursor: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(token: string): Cursor | null {
  if (!token || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !UUID.test(candidate.id)) return null;
    if (typeof candidate.createdAt !== "string" || candidate.createdAt.length > 64) return null;
    if (!Number.isFinite(Date.parse(candidate.createdAt))) return null;
    return { id: candidate.id, createdAt: candidate.createdAt };
  } catch {
    return null;
  }
}

function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return neon(connectionString);
}

function toTopicSummary(row: Record<string, unknown>): TopicSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    postCount: Number(row.post_count ?? 0),
  };
}

function toPost(row: Record<string, unknown>): TopicPost {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    parentPostId: row.parent_post_id == null ? null : String(row.parent_post_id),
    contentType: String(row.content_type),
    contentText: String(row.content_text),
    protocol: row.protocol == null ? null : String(row.protocol),
    submissionMethod: row.submission_method === "GET" ? "GET" : row.submission_method === "WEB" ? "WEB" : "POST",
    createdAt: String(row.created_at),
  };
}

export async function listTopics(limit: number, cursor: Cursor | null): Promise<{ topics: TopicSummary[]; nextCursor: string | null }> {
  const sql = getSql();
  const rows = (cursor
    ? await sql`
        SELECT t.id, t.title, t.created_at, t.updated_at,
          (SELECT count(*)::int FROM public.posts p WHERE p.topic_id = t.id AND p.status = 'visible') AS post_count
        FROM public.topics t
        WHERE t.status = 'visible'
          AND (t.created_at, t.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${limit + 1}
      `
    : await sql`
        SELECT t.id, t.title, t.created_at, t.updated_at,
          (SELECT count(*)::int FROM public.posts p WHERE p.topic_id = t.id AND p.status = 'visible') AS post_count
        FROM public.topics t
        WHERE t.status = 'visible'
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${limit + 1}
      `) as unknown as Record<string, unknown>[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(toTopicSummary);
  const lastRow = rows[Math.min(rows.length, limit) - 1];
  const nextCursor = hasMore && lastRow
    ? encodeCursor({ id: String(lastRow.id), createdAt: String(lastRow.created_at) })
    : null;

  return { topics: page, nextCursor };
}

export async function getTopicWithPosts(topicId: string, limit: number, cursor: Cursor | null): Promise<TopicWithPosts | null> {
  const sql = getSql();
  const topicRows = await sql`
    SELECT t.id, t.title, t.created_at, t.updated_at,
      (SELECT count(*)::int FROM public.posts p WHERE p.topic_id = t.id AND p.status = 'visible') AS post_count
    FROM public.topics t
    WHERE t.id = ${topicId}::uuid AND t.status = 'visible'
    LIMIT 1
  ` as unknown as Record<string, unknown>[];

  if (!topicRows[0]) return null;
  const topicSummary = toTopicSummary(topicRows[0]);
  const postsRows = (cursor
    ? await sql`
        SELECT p.id, p.topic_id, p.parent_post_id, p.content_type, p.content_text, p.protocol, p.submission_method, p.created_at
        FROM public.posts p
        WHERE p.topic_id = ${topicId}::uuid AND p.status = 'visible'
          AND (p.created_at, p.id) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)
        ORDER BY p.created_at ASC, p.id ASC
        LIMIT ${limit + 1}
      `
    : await sql`
        SELECT p.id, p.topic_id, p.parent_post_id, p.content_type, p.content_text, p.protocol, p.submission_method, p.created_at
        FROM public.posts p
        WHERE p.topic_id = ${topicId}::uuid AND p.status = 'visible'
        ORDER BY p.created_at ASC, p.id ASC
        LIMIT ${limit + 1}
      `) as unknown as Record<string, unknown>[];

  const hasMore = postsRows.length > limit;
  const pageRows = postsRows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];
  return {
    topic: {
      id: topicSummary.id,
      title: topicSummary.title,
      createdAt: topicSummary.createdAt,
      updatedAt: topicSummary.updatedAt,
    },
    posts: pageRows.map(toPost),
    nextCursor: hasMore && lastRow
      ? encodeCursor({ id: String(lastRow.id), createdAt: String(lastRow.created_at) })
      : null,
  };
}
