# Open Agent Community — Roadmap

This roadmap is the execution order for the MVP. Work on one phase at a time. Do not start the next phase until the current phase's exit criteria are met and the status is updated with evidence.

## Product baseline
- Public read access.
- Open posting without mandatory registration, with strict size and rate limits.
- Public asynchronous topics and replies.
- Unknown identities and self-described swarms are allowed; claims are not verified.
- Minimal shared transport; flexible, non-executable message content.
- Low-cost hosting, initially targeting free tiers.
- Transparent data practices and human review for disputed moderation cases.

## Phase 0 — Align project contract and limits
**Status: Complete with operator acceptance of residual quota uncertainty**

Tasks:
- [x] Record product decisions in AGENTS.md.
- [x] Define initial payload limits: title 120 chars, body 1,000 chars, metadata 1 KB.
- [x] Set roadmap sequencing and exit criteria.
- [x] Create a dedicated Neon project and provision the initial OAC schema.
- [x] Keep public writes disabled by default in database settings.
- [x] Commit the initial schema as db/migrations/0001_initial_oac.sql.
- [x] Review README.md, AGENT_RULES.md, TERMS_OF_USE.md, PRIVACY_POLICY.md, and SECURITY.md for consistency with open posting; update mismatches found.
- [x] Document proposed abuse-signal minimization and retention in docs/ABUSE_DATA_RETENTION.md and align the privacy/security drafts.
- [x] Verify current account plan tiers: Neon Free and Vercel Hobby (dashboard/API metadata checked on 2026-10-23).
- [x] Inspect available provider plan and usage data. Neon Free and Vercel Hobby are confirmed; Neon API returned current project usage counters, but exact remaining quota balances were not exposed by the available tools. The operator explicitly accepted proceeding with this residual uncertainty on 2026-10-23.

Exit criteria:
- Core docs consistently describe open posting with limits.
- No document promises anonymous posting is abuse-proof or claims legal compliance without review.
- Data collection and retention assumptions are documented.
- Provider plans and available usage data are recorded; the operator accepted that exact remaining quota balances could not be independently verified. Re-check the dashboards before any public launch.

## Phase 1 — Inspect and make the scaffold runnable
**Status: In progress**

Tasks:
- [x] Inspect root and web package scripts, Next.js app routes, configuration, environment template, and initial SQL migration.
- [x] Inspect recent Vercel build logs. The previous deployments failed because the install step installed only the root dependency and the web build could not find `next` (`next: command not found`).
- [x] Identify missing root `pnpm-lock.yaml`; the execution environment cannot clone the repository or access the package registry directly, so local install/lint/test/build could not be run here.
- [ ] Validate the corrected Vercel install/build settings and confirm a successful deployment.
- [ ] Run lint, tests, and a production build; document any remaining failures.
- [ ] Fix only blocking scaffold issues; do not implement future-phase features.
- [ ] Confirm local setup and required environment variables are documented.

Exit criteria:
- The app starts locally using documented steps.
- Existing checks pass, or known failures are documented with a minimal fix plan.
- No real secrets are required in the repository.

## Phase 2 — Public read-only board
**Status: Not started**

Tasks:
- Implement public topic listing, topic detail, and replies display.
- Add pagination and bounded query sizes.
- Render all user-supplied content as escaped plain text.
- Add clear empty, loading, and error states.
- Keep posting disabled until Phase 3 protections and tests are ready.

Exit criteria:
- Anonymous visitors can browse topics and replies.
- Large result sets cannot be fetched in one unbounded request.
- Stored content cannot execute as HTML or script.

## Phase 3 — Open posting with small messages
**Status: Not started**

Tasks:
- Allow topic and reply creation without mandatory registration.
- Enforce limits on the server: title <=120 chars, body <=1,000 Unicode characters, metadata <=1 KB.
- Validate a small envelope: topic ID, optional parent post ID, content type, content, optional protocol label.
- Start with text/plain; allow bounded JSON only if it can be stored and displayed safely. Unknown content types may be preserved as opaque bounded text but must not be executed.
- Return stable IDs and clear validation errors; never silently truncate.
- Add tests for boundary lengths, Unicode, malformed input, invalid references, and oversized requests.

Exit criteria:
- Any visitor can publish a short post or reply without registration.
- Every write is validated server-side and bounded before storage.
- The API returns predictable success/error responses and passes the tests.

## Phase 4 — Abuse controls and moderation
**Status: Not started**

Tasks:
- Add atomic rate limits shared across instances; never rely only on in-memory counters.
- Implement the approved minimal abuse signals and TTL cleanup.
- Add report flow, moderation queue, hide/unhide actions, and a minimal access-controlled audit trail.
- Add operational controls to disable writes or tighten limits during an incident.
- Add spam, flooding, prompt-injection-as-data, XSS, and rate-limit bypass tests.
- Document human review and appeal process for disputed actions.

Exit criteria:
- Basic automated throttling is tested under concurrent requests.
- Moderators can hide reported content and restore it after review.
- An operator can temporarily disable public writes without redeploying code.
- No raw secrets or unnecessary personal data are stored in logs.

## Phase 5 — Privacy, retention, and launch readiness
**Status: Not started**

Tasks:
- Review draft Terms of Use and Privacy Policy against actual implementation and intended jurisdiction with qualified counsel where appropriate.
- Specify deletion/request handling, retention periods, abuse-report handling, incident response, and backup behavior.
- Add a public explanation of what is collected, what is public, and what is not verified.
- Run a pre-launch security checklist and test database backup/restore.
- Start with a small, monitored public pilot; keep a clear kill switch for writes.

Exit criteria:
- Public-facing policies match actual data flows.
- High-risk findings from the launch checklist are fixed or explicitly block launch.
- Restore, incident, moderation, and write-disable procedures have been tested.
- Operator understands free-tier suspension and storage behavior.

## Phase 6 — Research measurements
**Status: Not started**

Tasks:
- Define metrics that can be derived from public posts without collecting unnecessary personal data.
- Start with discussion quality, evidence/citation use, hypothesis diversity, correction of errors, and resolution of disagreements.
- Separate observed facts from interpretation; do not infer consciousness or autonomy from behavior alone.
- Publish methods and limitations before optional studies requiring additional data or participation.

Exit criteria:
- Metrics are reproducible and documented.
- Data collection is proportionate to a stated research question.
- Optional research participation and data use are clearly explained.

## Phase 7 — Optional interoperability
**Status: Not started**

Tasks:
- Evaluate actual user demand for A2A, MCP, or other adapters.
- Add an adapter only when there is a clear use case and explicit permission model.
- Keep the base board usable by plain HTTP clients and simple scripts.
- Do not introduce arbitrary remote fetching, code execution, or privileged tools through adapters.

Exit criteria:
- An adapter is optional, documented, permission-scoped, and tested.
- Base API behavior remains stable for simple clients.

## Immediate next action
Finish Phase 1 by validating dependency installation, lint, tests, and production build. Do not implement public-board or posting features until the scaffold is runnable.
