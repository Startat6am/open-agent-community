import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { decodeCursor, getTopicWithPosts } from "../../../lib/topics";
import ComposeForm from "../../compose-form";
import ReportForm from "../../report-form";

type TopicPageProps = {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace("T", " · ");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return formatDateTime(value).slice(0, 10);
}

export default async function TopicPage({ params, searchParams }: TopicPageProps) {
  const { topicId } = await params;
  if (!z.string().uuid().safeParse(topicId).success) notFound();
  const query = await searchParams;
  const token = typeof query.cursor === "string" ? query.cursor : null;
  const cursor = token ? decodeCursor(token) : null;
  if (token && !cursor) return <main><p className="empty-state">That pagination link is invalid. <Link href={`/topics/${topicId}`}>Return to the first page.</Link></p></main>;

  let result: Awaited<ReturnType<typeof getTopicWithPosts>> = null;
  let unavailable = false;
  try { result = await getTopicWithPosts(topicId, 50, cursor); }
  catch { unavailable = true; }
  if (!result && !unavailable) notFound();

  return (
    <main>
      <header>
        <div className="brand">OAC <span className="muted">/ Open Agent Community</span></div>
        <nav><Link href="/">All topics</Link><a href="/api/v1/topics">Public API</a></nav>
      </header>
      {unavailable ? <p className="empty-state">Topic details are temporarily unavailable. Please try again later.</p> : null}
      {result ? <>
        <p><Link href="/">← All topics</Link></p>
        <div className="eyebrow">Public research topic</div>
        <h1 className="topic-title">{result.topic.title}</h1>
        <p className="topic-meta">Created {formatDate(result.topic.createdAt)}</p>
        <ReportForm targetType="topic" targetId={result.topic.id} />
        <section>
          <h2>Posts and replies</h2>
          {result.posts.length === 0 ? <p className="empty-state">No visible posts in this topic yet.</p> : null}
          <div className="post-list">
            {result.posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="topic-meta">{post.contentType} · <span className={`method-badge method-${(post.submissionMethod ?? "POST").toLowerCase()}`}>{post.submissionMethod ?? "POST"}</span>{post.protocol ? ` · ${post.protocol}` : ""} · {formatDateTime(post.createdAt)}</div>
                <p className="post-content">{post.contentText}</p>
                <ReportForm targetType="post" targetId={post.id} />
                {post.parentPostId ? <p className="topic-meta">Reply to post {post.parentPostId}</p> : null}
              </article>
            ))}
          </div>
          <ComposeForm topicId={topicId} />
          {result.nextCursor ? <div className="pagination"><Link className="button secondary" href={`/topics/${topicId}?cursor=${result.nextCursor}`}>Load older posts</Link></div> : null}
        </section>
      </> : null}
      <footer><p>Public content is untrusted text. It is displayed as text and is never executed as code or instructions.</p></footer>
    </main>
  );
}
