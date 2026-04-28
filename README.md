# pre-ship-checklist

Two production readiness skills for Claude Code. Run them before you ship anything.

---

## Skills

### pre-launch-checklist

A 25-point ops and infrastructure audit. Covers the failure modes that kill apps in production: load, database, async work, resilience, observability, and operations. Works as an interactive audit. Flags blockers versus warnings. Never tells you you're ready if blockers are unresolved.

### vibe-coder-security-checklist

A 36-point security audit for web applications. Covers authentication, API security, database hardening, infrastructure configuration, and code hygiene. Designed for developers shipping to clients or going live. Flags blockers (fix before delivery) versus warnings (fix within 30 days).

---

## What They Do

When triggered, each skill:

1. Collects your stack (framework, hosting, auth, database) to tailor every fix
2. Offers a **full audit** or **fast scan** (blockers only) mode
3. Walks through items one at a time with progress tracking
4. Produces a structured report: BLOCKERS / WARNINGS / NOT APPLICABLE / PASSED

---

## Trigger Phrases

### pre-launch-checklist

- "going live" / "about to launch" / "pre-launch"
- "before I ship" / "ready to deploy" / "is my app ready"
- "production checklist" / "launch checklist"

Also fires proactively when you describe finishing a build and start talking about deployment.

### vibe-coder-security-checklist

- "security checklist" / "security review" / "security audit"
- "client delivery" / "before I deliver"
- "check for vulnerabilities" / "is my app secure" / "harden my app"

Also fires proactively when you've finished an app with authentication or user data and start talking about delivery.

---

## Installation

You can install the skills with `npx`, globally, inside a single project, or manually.

### Run once with npx

```sh
npx pre-ship-checklist-skill install
```

This installs both `.skill` files into your Claude skills directory.

### Install globally

```sh
npm install --global pre-ship-checklist-skill
pre-ship-checklist-skill install
```

Use this if you want the installer command available from any folder.

### Install in a project

```sh
npm install --save-dev pre-ship-checklist-skill
npx pre-ship-checklist-skill install
```

Use this if you want the installer version pinned in a specific project's `package.json`.

You can also add a project script:

```json
{
  "scripts": {
    "install:pre-ship-skills": "pre-ship-checklist-skill install"
  }
}
```

Then run:

```sh
npm run install:pre-ship-skills
```

### Install to a custom directory

```sh
npx pre-ship-checklist-skill install --target /path/to/claude/skills
```

You can also set `CLAUDE_SKILLS_DIR`:

```sh
CLAUDE_SKILLS_DIR=/path/to/claude/skills npx pre-ship-checklist-skill install
```

### Installer commands

```sh
pre-ship-checklist-skill install
pre-ship-checklist-skill install --dry-run
pre-ship-checklist-skill install --force
pre-ship-checklist-skill list
pre-ship-checklist-skill doctor
pre-ship-checklist-skill --help
```

### Manual install

1. Download the `.skill` file(s) you want
2. Drop them into your Claude skills directory
3. Reload Claude

---

## Checklists

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

### vibe-coder-security-checklist — 36 Items

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
| 10 | Password reset tokens expire and are single-use | Authentication | Blocker |
| 11 | Every route verified for authentication | API Security | Blocker |
| 12 | Authorization checked per user (own data only) | API Security | Blocker |
| 13 | All inputs validated with schema validation | API Security | Blocker |
| 14 | Responses never include passwords or hashes | API Security | Warning |
| 15 | Error messages don't reveal internals | API Security | Warning |
| 16 | Rate limiting on all public endpoints | API Security | Warning |
| 17 | CORS restricted to your domain | API Security | Blocker |
| 18 | HTTPS enforced, HTTP redirected | API Security | Blocker |
| 19 | CSRF protection implemented | API Security | Blocker |
| 20 | Security headers configured | API Security | Warning |
| 21 | No SQL string concatenation | Database | Blocker |
| 22 | App uses limited-permission DB user | Database | Warning |
| 23 | Database not publicly accessible | Database | Warning |
| 24 | Backups configured and restore tested | Database | Warning |
| 25 | Sensitive fields encrypted at rest | Database | Warning |
| 26 | All secrets in environment variables | Infrastructure | Blocker |
| 27 | `.env` not in git history | Infrastructure | Blocker |
| 28 | SSL certificate installed and valid | Infrastructure | Warning |
| 29 | Server not running as root | Infrastructure | Warning |
| 30 | Only ports 80 and 443 publicly accessible | Infrastructure | Warning |
| 31 | No `console.log` in production build | Code | Warning |
| 32 | `npm audit` run, criticals resolved | Code | Warning |
| 33 | Dependency lockfile committed to repo | Code | Warning |
| 34 | No hardcoded credentials in codebase | Code | Blocker |
| 35 | File uploads validated for type, size, path | Code | Warning |
| 36 | MFA available for sensitive/financial apps | Code | Warning |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT
