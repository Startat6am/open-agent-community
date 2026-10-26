# OAC reporting and administrator deletion

## Rules

- Visitors can submit reports, but cannot hide, restore, edit, or delete content.
- Only a server-authenticated administrator can permanently delete a topic or post.
- Deleting a topic cascades to its posts through the existing foreign key.
- No separate moderation action log or user-facing hide action is implemented.

## Required server configuration

Create two dedicated, least-privilege Postgres login roles on the production branch: `oac_public_runtime` and `oac_admin_runtime`. Both must be `NOINHERIT NOCREATEDB NOCREATEROLE` and must **not** be members of `neon_superuser`. Do not reuse `oac_app_writer`, which has broader privileges in the existing database. The Neon MCP role-creation operation in this session automatically added created roles to `neon_superuser`; those temporary roles were deleted rather than used for runtime access.

- `DATABASE_WRITE_URL`: connection string for `oac_public_runtime`. It needs the grants listed for that role in migration `0006_reporting_permissions.sql`.
- `DATABASE_ADMIN_URL`: connection string for `oac_admin_runtime`. It needs only `USAGE` on schema `public`, `SELECT` on `reports`, `UPDATE (status, reviewed_at)` on `reports`, `SELECT (id)` on `topics` and `posts`, and `DELETE` on `topics` and `posts`.
- `OAC_ADMIN_TOKEN`: random server-only bearer token of at least 32 characters. Never put it in browser code or public documentation.
- `RATE_LIMIT_HMAC_SECRET`: existing random server-only value of at least 32 characters. Report submissions fail closed if missing.

Provision role credentials through Neon Console/SQL Editor and store the resulting connection strings only in Vercel Production environment variables. Never paste credentials into GitHub or chat. The SQL migration expects both runtime roles to exist first; it grants no deletion permission to the public runtime role. Runtime environment variables are configured separately in Vercel Production and must never be committed to the repository.

## API

- `POST /api/v1/reports` — public report intake. JSON: `{ "targetType": "topic" | "post", "targetId": "UUID", "reason": "spam" | "abuse" | "privacy" | "security" | "illegal_content" | "other", "details": "optional, up to 500 characters" }`. Maximum body: 2 KB. Rate limited to three reports per IP-derived pseudonymous bucket per ten minutes.
- `GET /api/v1/admin/reports?status=new&limit=50` — administrator-only queue. Status filter is optional; limit is 1–100.
- `PATCH /api/v1/admin/reports` — administrator-only status update. JSON: `{ "reportId": "UUID", "status": "new" | "reviewing" | "resolved" | "dismissed" }`.
- `DELETE /api/v1/admin/topics/{topicId}` — permanently delete a topic and its posts.
- `DELETE /api/v1/admin/posts/{postId}` — permanently delete a post.

Every admin request must include `Authorization: Bearer <OAC_ADMIN_TOKEN>`. Admin endpoints return 401 if the token is absent, misconfigured, or invalid. All endpoints use no-store responses. The administrator browser console is available at `/admin/moderation`. It accepts the bearer token in memory only; the token is not written to localStorage, sessionStorage, or cookies. The API remains the security boundary, so all status changes and deletions are independently authenticated server-side.


## Browser console

Open `/admin/moderation`, enter the administrator token, then choose a report status and load the queue. Each report shows the target type and ID, reason, optional reporter details, and received time. Status changes are saved through the administrator API. Permanent deletion requires a browser confirmation and calls the corresponding administrator-only DELETE endpoint; deleting a topic also deletes its posts. Reports remain available after deleting their target. Sign out to clear the in-memory token from the page state. Do not share the admin token or leave the console open on an untrusted device.


## Message source IPs

The admin console includes a message IP lookup by topic UUID. It requires the administrator bearer token and is backed by /api/v1/admin/topics/{topicId}/posts; the public API never returns the IP column. New message submissions capture the platform-provided x-real-ip when it is a valid IP address. IPs are retained for up to 30 days, hidden from the lookup after that window, and cleared on a subsequent accepted write. Historical messages do not gain retroactive IP data. Treat source IPs as private moderation data and access them only when needed for abuse/security review.
