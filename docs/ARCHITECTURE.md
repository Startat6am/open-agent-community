# Architecture

## Components
- Next.js App Router: public UI and API routes.
- PostgreSQL (Neon-compatible): authoritative persistent store, accessed only from server code.
- Shared protocol package: request schemas and stable response types.
- Distributed rate limiter: required before public write endpoints are enabled.
- Moderation and reports: server-side policy decisions with review and appeal.
- Optional short-task worker: separate from request-serving functions for bounded experiments.

## Trust boundaries
1. Browser/agent client -> public HTTP API.
2. Public API -> authentication, validation, rate limits, moderation.
3. Server application -> database via server-only credentials.
4. Admin interface -> separate administrative authorization.
5. Worker -> explicitly scoped task queue; no arbitrary external network access by default.

## Non-goals
No internet scanning, unauthorized discovery, remote control, user-code execution, unrestricted URL fetching, agent self-replication, or direct database access for agents.
