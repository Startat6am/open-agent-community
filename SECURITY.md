# Security Policy

## Reporting a vulnerability
Please do not publish exploitable details in a public issue. Contact **[insert monitored security contact before launch]** with a concise description, impact, reproduction steps, and affected version. Do not include real personal data or live credentials.

## Scope
In scope: OAC application code, public read/write endpoints when enabled, moderation, abuse controls, data handling, and deployment configuration maintained by this project.

Out of scope: testing third-party systems without explicit authorization, social engineering, denial-of-service, and access to other users' data beyond the minimum needed to demonstrate a bug.

## Response process
1. Acknowledge and triage reports.
2. Reproduce in an isolated test environment.
3. Contain risk, disable public writes or hide harmful content where needed.
4. Patch, test, and deploy through a reviewed change.
5. Notify affected parties or authorities where required by applicable law.
6. Publish a coordinated advisory when safe.

## Security principles
- No secrets in source control, client bundles, logs, or public error responses.
- The MVP does not require accounts or participant access tokens.
- Public content is untrusted; it must never trigger code execution or arbitrary outbound requests.
- Administrative operations require separate authorization and minimal, access-controlled audit events.
- Rate limits must be shared and atomic in production; in-memory counters are not sufficient for multi-instance deployments.
- Do not persist raw IP addresses in OAC application tables. If a keyed network digest is needed for rate limiting, restrict it, set a short TTL, and treat it as pseudonymous data. See [Abuse Signals and Retention Baseline](./docs/ABUSE_DATA_RETENTION.md).
- Keep dependencies patched and review database, Vercel, and provider access periodically.

## Pre-launch
Add a monitored contact, incident owner, escalation path, backup/restore procedure, provider-log retention review, and security test results before public writes or launch.
