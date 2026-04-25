# pre-ship-checklist

Two production readiness skills for Claude. Run them before you ship anything.

---

## Skills

### pre-launch-checklist

A 25-point ops and infrastructure audit. Covers the failure modes that kill apps in production: load, database, async work, resilience, observability, and operations. Works as an interactive audit. Flags blockers versus warnings. Never tells you you're ready if blockers are unresolved.

### vibe-coder-security-checklist

A 30-point security audit for web applications. Covers authentication, API security, database hardening, infrastructure configuration, and code hygiene. Tailored for vibe coders and freelancers shipping to clients. Flags blockers (ship-stopping vulnerabilities) versus warnings (fix within 30 days).

---

## What They Do

When triggered, each skill runs through its checklist interactively. For each item, Claude checks your stack, identifies the specific risk, and gives a concrete fix. At the end it produces a structured report with two buckets: blockers (must fix before launch/delivery) and warnings (fix within 30 days).

---

## Trigger Phrases

### pre-launch-checklist

- "going live"
- "about to launch"
- "pre-launch"
- "before I ship"
- "production checklist"
- "ready to deploy"
- "is my app ready"
- "launch checklist"

Also fires proactively when you describe finishing a build and start talking about deployment.

### vibe-coder-security-checklist

- "security checklist"
- "security review"
- "client delivery"
- "pre-ship security"
- "before I deliver"
- "check for vulnerabilities"
- "is my app secure"
- "security audit"

Also fires proactively when you've finished an app with authentication or user data and start talking about delivery.

---

## Installation

1. Download the `.skill` file(s) you want
2. Drop them into your Claude skills directory
3. Reload Claude

---

## The Checklists (Summary)

### pre-launch-checklist — 25 Items

| # | Item | Category | Severity |
|---|------|----------|----------|
| 1 | Load testing before launch | Load and Scale | Blocker |
| 2 | Session data not in server memory | Load and Scale | Blocker |
| 3 | File uploads go to object storage | Load and Scale | Blocker |
| 4 | CDN in front of static assets | Load and Scale | Warning |
| 5 | Database read replica exists | Database | Warning |
| 6 | All foreign key columns indexed | Database | Blocker |
| 7 | Migrations not auto-run on app start | Database | Warning |
| 8 | Backups tested with actual restore | Database | Warning |
| 9 | Multi-step writes use transactions | Database | Blocker |
| 10 | Search queries parameterized or indexed | Database | Warning |
| 11 | Email sending offloaded to a queue | Async | Warning |
| 12 | Background tasks run in a queue | Async | Warning |
| 13 | No hardcoded secrets in CI | Resilience | Blocker |
| 14 | Rate limiting configured | Resilience | Blocker |
| 15 | Outbound HTTP calls have timeouts | Resilience | Blocker |
| 16 | Circuit breakers on external calls | Resilience | Warning |
| 17 | Fallback for critical third-party APIs | Resilience | Warning |
| 18 | WebSockets handled by stateful service | Resilience | Warning |
| 19 | Error alerting configured | Observability | Blocker |
| 20 | Logs go to centralized service | Observability | Warning |
| 21 | Health check endpoint exists | Observability | Blocker |
| 22 | API responses compressed | Observability | Warning |
| 23 | Graceful shutdown implemented | Operations | Warning |
| 24 | Memory leak detection in place | Operations | Warning |
| 25 | Runbook exists for common incidents | Operations | Blocker |

### vibe-coder-security-checklist — 30 Items

| # | Item | Category | Severity |
|---|------|----------|----------|
| 1 | Passwords hashed with bcrypt or argon2 | Authentication | Blocker |
| 2 | Tokens in httpOnly cookies, not localStorage | Authentication | Blocker |
| 3 | JWT secret random and at least 32 characters | Authentication | Blocker |
| 4 | Access tokens expire within 15–60 minutes | Authentication | Warning |
| 5 | Refresh token rotation implemented | Authentication | Warning |
| 6 | Rate limiting on /login and /register | Authentication | Blocker |
| 7 | Account lockout after repeated failures | Authentication | Warning |
| 8 | Sessions invalidated server-side on logout | Authentication | Blocker |
| 9 | Email verification required before access | Authentication | Warning |
| 10 | Every route verified for authentication | API Security | Blocker |
| 11 | Authorization checked per user (own data only) | API Security | Blocker |
| 12 | All inputs validated with schema validation | API Security | Blocker |
| 13 | Responses never include passwords or hashes | API Security | Warning |
| 14 | Error messages don't reveal internals | API Security | Warning |
| 15 | Rate limiting on all public endpoints | API Security | Warning |
| 16 | CORS restricted to your domain | API Security | Blocker |
| 17 | HTTPS enforced, HTTP redirected | API Security | Blocker |
| 18 | No SQL string concatenation | Database | Blocker |
| 19 | App uses limited-permission DB user | Database | Warning |
| 20 | Database not publicly accessible | Database | Warning |
| 21 | Backups configured and restore tested | Database | Warning |
| 22 | Sensitive fields encrypted at rest | Database | Warning |
| 23 | All secrets in environment variables | Infrastructure | Blocker |
| 24 | `.env` not in git history | Infrastructure | Blocker |
| 25 | SSL certificate installed and valid | Infrastructure | Warning |
| 26 | Server not running as root | Infrastructure | Warning |
| 27 | Only ports 80 and 443 publicly accessible | Infrastructure | Warning |
| 28 | No `console.log` in production build | Code | Warning |
| 29 | `npm audit` run, criticals resolved | Code | Warning |
| 30 | No hardcoded credentials in codebase | Code | Blocker |

---

## License

MIT
