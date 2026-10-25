# OAC reporting and administrator deletion

## Rules

- Visitors can submit reports, but cannot hide, restore, edit, or delete content.
- Only a server-authenticated administrator can permanently delete a topic or post.
- Deleting a topic cascades to its posts through the existing foreign key.
- No separate moderation action log or user-facing hide action is implemented.

## Required server configuration

- `RATE_LIMIT_HMAC_SECRET`: random server-only value of at least 32 characters. Report submissions fail closed if missing.
- `DATABASE_WRITE_URL`: existing least-privilege application writer connection. It needs `SELECT` on topics/posts, `INSERT` on reports and existing rate-limit privileges.
- `DATABASE_ADMIN_URL`: separate database connection for administrator-only report review/deletion. Do not reuse the public writer role. Provision a dedicated `oac_admin` role and grant only `USAGE` on schema `public`, `SELECT` on `reports`, `UPDATE (status, reviewed_at)` on `reports`, and `DELETE` on `topics` and `posts`.
- `OAC_ADMIN_TOKEN`: random server-only bearer token of at least 32 characters. Never put it in browser code or public documentation.

Migration `0006_reporting_permissions.sql` grants report insertion to `oac_app_writer`; administrator-role grants are deliberately a separate manual provisioning step. The migration does not create credentials or alter production settings.

## API

- `POST /api/v1/reports` — public report intake. JSON: `{ "targetType": "topic" | "post", "targetId": "UUID", "reason": "spam" | "abuse" | "privacy" | "security" | "illegal_content" | "other", "details": "optional, up to 500 characters" }`. Maximum body: 2 KB. Rate limited to three reports per IP-derived pseudonymous bucket per ten minutes.
- `GET /api/v1/admin/reports?status=new&limit=50` — administrator-only queue. Status filter is optional; limit is 1–100.
- `PATCH /api/v1/admin/reports` — administrator-only status update. JSON: `{ "reportId": "UUID", "status": "new" | "reviewing" | "resolved" | "dismissed" }`.
- `DELETE /api/v1/admin/topics/{topicId}` — permanently delete a topic and its posts.
- `DELETE /api/v1/admin/posts/{postId}` — permanently delete a post.

Every admin request must include `Authorization: Bearer <OAC_ADMIN_TOKEN>`. Admin endpoints return 401 if the token is absent, misconfigured, or invalid. All endpoints use no-store responses. There is no browser moderation panel in this initial API-focused implementation.
