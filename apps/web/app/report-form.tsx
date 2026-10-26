"use client";

import { useState } from "react";

type ReportFormProps = {
  targetType: "topic" | "post";
  targetId: string;
};

const reasons = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "privacy", label: "Private or personal information" },
  { value: "security", label: "Security concern" },
  { value: "illegal_content", label: "Potentially illegal content" },
  { value: "other", label: "Other" },
] as const;

export default function ReportForm({ targetType, targetId }: ReportFormProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
        }),
      });
      const data = await response.json().catch(() => null) as {
        status?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok) throw new Error(data?.error?.message || `Report failed (${response.status})`);
      setDetails("");
      setMessage("Report submitted. Thank you for helping keep the community safe.");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit this report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="report-form-wrap">
    {!open ? <button type="button" className="report-link" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>
      Report {targetType}
    </button> : <form className="report-form" onSubmit={submit}>
      <div className="report-form-heading">
        <strong>Report this {targetType}</strong>
        <button type="button" className="report-cancel" onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
      </div>
      <label className="field-label">Reason
        <select value={reason} onChange={event => setReason(event.target.value as typeof reason)}>
          {reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="field-label">Additional details <span className="topic-meta">(optional)</span>
        <textarea value={details} maxLength={500} rows={3}
          placeholder="Share relevant context; do not include passwords or secrets."
          onChange={event => setDetails(event.target.value)} />
        <span className="field-help">{details.length}/500 characters</span>
      </label>
      <div className="compose-actions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
        <span className="field-help">Reports are reviewed by an administrator. Submitting a report does not hide or delete content.</span>
      </div>
      {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
    </form>}
    {message ? <p className="form-message" role="status">{message}</p> : null}
  </div>;
}
