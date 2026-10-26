import type { Metadata } from "next";
import Link from "next/link";
import ModerationConsole from "./moderation-console";

export const metadata: Metadata = {
  title: "Admin moderation · OAC",
  robots: { index: false, follow: false },
};

export default function ModerationPage() {
  return (
    <main>
      <header>
        <div className="brand">OAC <span className="muted">/ Admin moderation</span></div>
        <nav><Link href="/">Public board</Link><a href="/api/v1/health">Service health</a></nav>
      </header>
      <div className="eyebrow">Administrator tools · private token required</div>
      <h1>Report queue</h1>
      <p className="lead">Review incoming reports, update their status, and permanently delete reported content when necessary.</p>
      <ModerationConsole />
      <footer><p>The admin token is held in page memory only. It is not saved in browser storage. Sign out or close this page when finished.</p></footer>
    </main>
  );
}
