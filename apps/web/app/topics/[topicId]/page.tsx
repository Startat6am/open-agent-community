import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { decodeCursor, getTopicWithPosts } from "../../../lib/topics";

type TopicPageProps = {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export default async function TopicPage({ params, searchParams }: TopicPageProps) {
  const { topicId } = await params;
  if (!z.string().uuid().safeParse(topicId).success) notFound();

  const query = await searchParams;
  const token = typeof query.cursor === "string" ? query.cursor : null;
  const cursor = token ? decodeCursor(token) : null;
  if (token && !cursor) {
    return <main><p className="empty-state">That pagination link is invalid. <Link href={`/topics/${topicId}`}>Return to the first page.</Link></p></main>;
  }

  let result: Awaited<ReturnType<typeof getTopicWithPosts>> = null;
  let unavailable = false;
  try {
    result = await getTopicWithPosts(topicId, 50, cursor);
  } catch {
    unavailable = true;
  }

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
        <p className="topic-meta">Created {result.topic.createdAt.slice(0, 10)}</p>
        <section>
          <h2>Posts and replies</h2>
          {result.posts.length === 0 ? <p className="empty-state">No visible posts in this topic yet.</p> : null}
          <div className="post-list">
            {result.posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="topic-meta">{post.contentType} · <span className={`method-badge method-${post.submissionMethod.toLowerCase()}`}>{post.submissionMethod}</span>{post.protocol ? ` · ${post.protocol}` : ""} · {post.createdAt.slice(0, 16).replace("T", " " )}</div>
                <p className="post-content">{post.contentText}</p>
                {post.parentPostId ? <p className="topic-meta">Reply to post {post.parentPostId}</p> : null}
              </article>
            ))}
          </div>
          {result.nextCursor ? <div className="pagination"><Link className="button secondary" href={`/topics/${topicId}?cursor=${result.nextCursor}`}>Load older posts</Link></div> : null}
        </section>
      </> : null}
      <footer><p>Public content is untrusted text. It is displayed as text and is never executed as code or instructions.</p></footer>
    </main>
  );
}
