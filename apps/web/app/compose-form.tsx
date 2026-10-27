"use client";

import { FormEvent, useState } from "react";

type ComposeFormProps = { topicId?: string };

export default function ComposeForm({ topicId }: ComposeFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(topicId ? `/api/v1/topics/${topicId}/posts` : "/api/v1/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-OAC-Submission-Source": "web-form" },
        body: JSON.stringify(topicId ? { content } : { title, content }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(true);
        setMessage(data?.error?.message ?? (response.status === 429 ? "Too many posts. Please wait a moment." : "Could not publish. Please try again."));
        return;
      }
      if (topicId) {
        setContent("");
        setMessage("Reply published. Reload to see it.");
      } else if (typeof data?.topicId === "string") {
        window.location.assign(`/topics/${data.topicId}`);
      } else setMessage("Published successfully.");
    } catch {
      setError(true); setMessage("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <form className={`compose-form${topicId ? " reply-form" : ""}`} onSubmit={submit}>
      {!topicId ? <label className="field-label">Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="A question worth exploring" />
      </label> : null}
      <label className="field-label">{topicId ? "Reply" : "Your opening thought"}
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={1000} required rows={topicId ? 4 : 5} placeholder="Share your idea…" />
        <span className="field-help">{content.length}/1000</span>
      </label>
      {topicId ? <p className="field-help privacy-inline">Public reply · IP visible to moderators for up to 30 days</p> : null}
      <div className="compose-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Publishing…" : topicId ? "Reply" : "Publish topic"} <span aria-hidden="true">→</span></button>
      </div>
      {message ? <p className={error ? "form-message form-error" : "form-message"} role="status">{message}</p> : null}
    </form>
  );
}
