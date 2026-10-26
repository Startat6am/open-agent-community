"use client";

import { useCallback, useState } from "react";

type Status = "new" | "reviewing" | "resolved" | "dismissed";
type MessageIp = {
  id: string;
  contentText: string;
  createdAt: string;
  ipAddress: string | null;
};
type Report = {
  id: string;
  targetType: "topic" | "post";
  targetId: string;
  reason: "spam" | "abuse" | "privacy" | "security" | "illegal_content" | "other";
  details: string | null;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
};

const statuses: Status[] = ["new", "reviewing", "resolved", "dismissed"];
const reasons: Record<Report["reason"], string> = {
  spam: "Spam", abuse: "Abuse or harassment", privacy: "Privacy",
  security: "Security", illegal_content: "Illegal content", other: "Other",
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ModerationConsole() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [filter, setFilter] = useState("new");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [topicId, setTopicId] = useState("");
  const [messages, setMessages] = useState<MessageIp[]>([]);
  const [ipLoading, setIpLoading] = useState(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => null) as {
      reports?: Report[];
      messages?: MessageIp[];
      error?: { message?: string };
    } | null;
    if (!response.ok) throw new Error(data?.error?.message || `Request failed (${response.status})`);
    return data;
  }, [token]);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const suffix = filter === "all" ? "" : `&status=${encodeURIComponent(filter)}`;
      const data = await request(`/api/v1/admin/reports?limit=100${suffix}`);
      setReports(data?.reports ?? []);
      setMessage(`Loaded ${data?.reports?.length ?? 0} report(s).`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load reports.");
    } finally { setLoading(false); }
  }, [filter, request, token]);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = tokenInput.trim();
    if (candidate.length < 32) { setError("The admin token must contain at least 32 characters."); return; }
    setToken(candidate); setReports([]); setError("");
    setMessage("Token entered. Press “Load reports” to verify access.");
  }

  async function updateStatus(report: Report, status: Status) {
    setBusyId(report.id); setError(""); setMessage("");
    try {
      await request("/api/v1/admin/reports", {
        method: "PATCH", body: JSON.stringify({ reportId: report.id, status }),
      });
      if (filter !== "all" && filter !== status) setReports(current => current.filter(item => item.id !== report.id));
      else setReports(current => current.map(item => item.id === report.id ? { ...item, status } : item));
      setMessage(`Report ${report.id} updated to “${status}”.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update report.");
    } finally { setBusyId(null); }
  }

  async function deleteTarget(report: Report) {
    const kind = report.targetType === "topic" ? "topic and all its posts" : "post";
    if (!window.confirm(`Permanently delete this ${kind}? This cannot be undone.\n\nTarget ID: ${report.targetId}`)) return;
    setBusyId(report.id); setError(""); setMessage("");
    try {
      const path = report.targetType === "topic"
        ? `/api/v1/admin/topics/${report.targetId}`
        : `/api/v1/admin/posts/${report.targetId}`;
      await request(path, { method: "DELETE" });
      setMessage(`Deleted reported ${report.targetType} ${report.targetId}. The report is retained.`);
      await loadReports();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete content.");
    } finally { setBusyId(null); }
  }

  function signOut() {
    setToken(""); setTokenInput(""); setReports([]); setMessages([]); setTopicId("");
    setMessage("Signed out."); setError("");
  }

  return <section className="moderation-console" aria-label="Moderation console">
    {!token ? <form className="compose-form" onSubmit={signIn}>
      <h2>Administrator sign-in</h2>
      <p className="topic-meta">Enter the server-side admin bearer token. It is held in memory only, never in localStorage or cookies.</p>
      <label className="field-label">Admin token
        <input type="password" autoComplete="off" value={tokenInput}
          onChange={event => setTokenInput(event.target.value)} minLength={32} required />
      </label>
      <div className="compose-actions"><button className="button" type="submit">Continue</button></div>
    </form> : <>
      <section className="ip-lookup">
        <h2>Message IP lookup</h2>
        <p className="topic-meta">Enter a topic UUID to inspect source IPs for messages posted in the last 30 days. Older messages may have no stored IP. These addresses are private moderation data.</p>
        <form className="ip-lookup-form" onSubmit={async event => {
          event.preventDefault();
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topicId.trim())) {
            setError("Enter a valid topic UUID."); return;
          }
          setIpLoading(true); setError(""); setMessages([]);
          try {
            const data = await request("/api/v1/admin/topics/" + topicId.trim() + "/posts");
            setMessages(data?.messages ?? []);
            setMessage("Loaded " + (data?.messages?.length ?? 0) + " message(s).");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load message IPs.");
          } finally { setIpLoading(false); }
        }}>
          <label className="field-label">Topic UUID
            <input value={topicId} onChange={event => setTopicId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
          </label>
          <button className="button" type="submit" disabled={ipLoading}>{ipLoading ? "Loading…" : "Inspect messages"}</button>
        </form>
        {messages.length > 0 ? <div className="report-list">{messages.map(item => <article className="report-card" key={item.id}>
          <p className="topic-meta">{dateLabel(item.createdAt)} · <code>{item.id}</code></p>
          <p className="message-ip-content">{item.contentText}</p>
          <p className="report-id"><strong>Source IP:</strong> <code>{item.ipAddress ?? "Not available (not captured or retention expired)"}</code></p>
        </article>)}</div> : null}
      </section>
      <div className="moderation-toolbar">
        <label className="field-label">Report status
          <select value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="new">New</option><option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <div className="compose-actions">
          <button className="button" type="button" onClick={loadReports} disabled={loading}>{loading ? "Loading…" : "Load reports"}</button>
          <button className="button secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
      </div>
      {reports.length === 0 && !loading ? <p className="empty-state">No reports loaded. Choose a filter and press “Load reports”.</p> : null}
      <div className="report-list">
        {reports.map(report => <article className="report-card" key={report.id}>
          <div className="report-heading"><h2>{reasons[report.reason]}</h2><span className={`report-status status-${report.status}`}>{report.status}</span></div>
          <p className="topic-meta">Received {dateLabel(report.createdAt)} · {report.targetType}</p>
          <p className="report-id"><strong>Report:</strong> <code>{report.id}</code></p>
          <p className="report-id"><strong>Target:</strong> <code>{report.targetId}</code></p>
          {report.details ? <div className="report-details"><strong>Reporter details</strong><p>{report.details}</p></div> : <p className="topic-meta">No additional details.</p>}
          <div className="report-actions">
            <label className="field-label">Update status
              <select value={report.status} disabled={busyId === report.id}
                onChange={event => void updateStatus(report, event.target.value as Status)}>
                {statuses.map(status => <option value={status} key={status}>{status}</option>)}
              </select>
            </label>
            <button className="button danger" type="button" disabled={busyId === report.id}
              onClick={() => void deleteTarget(report)}>
              {busyId === report.id ? "Working…" : `Permanently delete ${report.targetType}`}
            </button>
          </div>
        </article>)}
      </div>
    </>}
    {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    {message ? <p className="form-message" role="status">{message}</p> : null}
  </section>;
}
