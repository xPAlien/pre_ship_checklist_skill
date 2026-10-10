---
name: vibe-coder-security-checklist
description: "Security checklist for web applications before shipping to a client or going live. Use this skill whenever the user is about to deliver to a client, do a security review, or ship an app and wants to check for vulnerabilities. Triggers on: security checklist, security review, client delivery, pre-ship security, before I deliver, check for vulnerabilities, is my app secure, harden my app, security audit, vibe coder checklist. Also trigger proactively when a user has just finished building an app with authentication or user data and is talking about delivery or deployment."
---

# Vibe Coder Pre-Ship Security Checklist

36 security checks across authentication, API security, database, infrastructure, and code hygiene. Run through every item before client delivery.

---

## How to Use This Skill

### Step 1 — Collect the stack

Before running any checklist items, inspect the repository and provider configuration. Ask only for missing context:

- **Frontend framework**: Next.js, Nuxt, SvelteKit, plain React, other?
- **Backend/API**: Same framework, Express, FastAPI, Django, Rails, other?
- **Auth method**: NextAuth, Supabase Auth, Clerk, custom JWT, session-based, other?
- **Database**: Postgres, MySQL, MongoDB, Supabase, other?
- **Hosting**: Vercel, Railway, Render, AWS, Fly.io, other?

Use these answers to tailor every fix. "Store tokens in httpOnly cookies" looks different in Next.js (set-cookie response header) versus Express (res.cookie with options) versus Supabase (handled by the client library).

### Step 2 — Choose a mode

Ask the user:
- **Full audit** — all 36 items (recommended before first client delivery)
- **Fast scan** — 16 baseline blocker items, marking irrelevant controls NOT APPLICABLE with a reason

Blockers: items 1, 2, 3, 6, 8, 10, 11, 12, 13, 17, 18, 19, 21, 26, 27, 34

### Step 3 — Run the checklist

Present items one at a time. Show progress ("Item X of 36" or "Item X of 15" in fast mode). For each item, record PASS, FAIL, NEEDS VERIFICATION, or NOT APPLICABLE with evidence. Verbal assurance alone does not verify a critical control.

- Applicable failed baseline blockers require correction before release.
- Warning due dates depend on real risk and an accountable owner, not a universal 30-day deadline.
- Unknown critical checks block release. For N/A, record a specific reason.

---

## Applicability and evidence

Baseline blocker and warning labels are screening defaults, not universal architecture mandates. For each item, inspect actual project behavior, code, tests and provider evidence. Static sites need no database, email queue or protected user routes unless they implement these features. Unverified critical checks remain blockers for the main `ship` release decision. Distinguish evidence from user assurances.

## The 36 Items

### Authentication

1. **[BLOCKER] Password login uses adaptive password hashing or a trusted identity provider**
   - Risk: MD5, SHA1, or plain-text passwords are cracked in minutes after a database breach.
   - Fix: Use a reviewed adaptive password hash such as Argon2id or bcrypt with current work factors. If fully delegated to a provider or using passkeys, inspect provider configuration.

2. **[BLOCKER] Browser session credentials follow a secure storage and rotation design**
   - Risk: Any XSS vulnerability can steal tokens from localStorage. httpOnly cookies are inaccessible to JavaScript.
   - Fix: Prefer HttpOnly and Secure cookies with appropriate SameSite on browser sessions. For other token designs, review XSS exposure, expiry, rotation and revocation.

3. **[BLOCKER] JWT signing keys and authentication secrets match the algorithm and trust model**
   - Risk: Tutorial secrets like `secret` or `mysecret` are in public wordlists and brute-forced trivially.
   - Fix: Use strong random symmetric keys or managed asymmetric signing keys as appropriate. Keep private signing material in environment-scoped secrets management.

4. **[WARNING] Access tokens expire within 15 to 60 minutes**
   - Risk: Non-expiring tokens are permanently valid after theft.
   - Fix: Set short expiry on access tokens. Use refresh tokens for session continuity.

5. **[WARNING] Refresh token rotation implemented**
   - Risk: Stolen refresh tokens grant indefinite access.
   - Fix: Issue a new refresh token on every use. Invalidate the old one immediately.

6. **[BLOCKER] Rate limiting on /login and /register**
   - Risk: No rate limit means unlimited password guessing and account enumeration at machine speed.
   - Fix: Limit to 5–10 attempts per IP per minute. Use Upstash Redis or a middleware layer.

7. **[WARNING] Authentication resists repeated password attempts without causing user lockout abuse**
   - Risk: Attacker can brute-force indefinitely even with rate limiting if limits reset too fast.
   - Fix: Use progressive rate limits, monitoring, step-up authentication, or bounded lockouts without enabling attacker-driven denial of service.

8. **[BLOCKER] Sessions invalidated server-side on logout**
   - Risk: Client-side logout only removes the cookie but the token remains valid if stolen before logout.
   - Fix: Maintain a token blocklist or use short-lived tokens with server-side session tracking.

9. **[WARNING] Email verification required before access is granted**
   - Risk: Anyone can register with someone else's email and act as them.
   - Fix: Send verification email on register. Block access to protected routes until verified.

10. **[BLOCKER] Password reset tokens expire and are single-use**
    - Risk: Long-lived or reusable reset tokens are permanent account takeover links.
    - Fix: Expire reset tokens after 15–60 minutes. Invalidate immediately on use. Hash them before storing.

### API Security

11. **[BLOCKER] Every route verified for authentication — not just the obvious ones**
    - Risk: Developers add routes quickly and forget to add auth middleware. One unprotected route exposes everything.
    - Fix: Audit every route. Use a global auth middleware that denies by default, then explicitly allow public routes.

12. **[BLOCKER] Authorization checked: each user can only access their own data**
    - Risk: User A passes User B's ID in the request and gets their data. This is the most common API vulnerability.
    - Fix: Always filter database queries by the authenticated user's ID. Never trust IDs from the request body alone.

13. **[BLOCKER] All request inputs validated with schema validation**
    - Risk: Unvalidated inputs are the root cause of injection attacks, type confusion, and unexpected behavior at scale.
    - Fix: Use Zod, Joi, Yup, or your framework's built-in validation on every request body, query param, and header.

14. **[WARNING] API responses never include passwords, hashes, or internal fields**
    - Risk: Serializing full database objects leaks fields the client was never meant to see.
    - Fix: Explicitly allowlist the fields returned in every API response. Never serialize raw DB models.

15. **[WARNING] Error messages don't reveal system internals or file paths**
    - Risk: Stack traces and file paths expose your architecture to attackers.
    - Fix: Return generic error messages in production. Log full details server-side only.

16. **[WARNING] Rate limiting on all public-facing endpoints**
    - Risk: No rate limit means your API can be scraped, abused, or DoS'd without friction.
    - Fix: Apply a global rate limit at the edge (Cloudflare) or API layer (Upstash Redis).

17. **[BLOCKER] CORS policy is correct for credentialed and public resource access**
    - Risk: An overly broad credentialed cross-origin policy can expose private responses to untrusted origins.
    - Fix: Restrict credentialed origins and test actual browser requests. Wildcard origins can be appropriate for intentionally public, non-credentialed responses.

18. **[BLOCKER] HTTPS enforced, HTTP redirected**
    - Risk: HTTP exposes tokens, session cookies, and data to anyone on the network path.
    - Fix: Redirect all HTTP to HTTPS at the server or CDN level. Set HSTS headers.

19. **[BLOCKER] Cookie-authenticated state changes resist CSRF**
    - Risk: A malicious site can trigger authenticated requests on behalf of a logged-in user.
    - Fix: Enforce Origin validation, SameSite policy and/or CSRF tokens for state-changing browser cookie sessions. Document why CSRF is N/A for token-only APIs.

20. **[WARNING] Security headers configured**
    - Risk: Missing headers enable clickjacking, MIME sniffing, and XSS attacks that a single response header would prevent.
    - Fix: Set `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`. Use helmet.js (Node) or equivalent middleware.

### Database

21. **[BLOCKER] No SQL string concatenation — use parameterized queries or ORM**
    - Risk: String-concatenated SQL is injectable. One malformed input can dump or destroy your database.
    - Fix: Use parameterized queries, prepared statements, or a safe ORM like Prisma. Never build SQL with user input.

22. **[WARNING] Application uses a limited-permission DB user, not root**
    - Risk: Root database access means a compromised app can drop tables, create users, or exfiltrate everything.
    - Fix: Create a DB user with only SELECT, INSERT, UPDATE, DELETE on the application schema. No DDL permissions.

23. **[WARNING] Database network exposure is controlled and documented**
    - Risk: A publicly exposed database can be reached by any scanner on the internet.
    - Fix: Prefer private access when available. For managed public endpoints, verify TLS, strong auth, least privilege, and provider network controls.

24. **[WARNING] Backups configured and a restore has been tested**
    - Risk: Having backups you've never restored is not a backup strategy. You'll find out it's broken during an incident.
    - Fix: Run a full restore to a staging environment. Verify the data. Schedule this monthly.

25. **[WARNING] Sensitive stored data receives suitable encryption and access controls**
    - Risk: PII, payment data, or health data stored in plaintext is fully exposed after any database breach.
    - Fix: Verify encryption at rest and access controls. Use field-level encryption and managed keys when justified by data classification and threat model.

### Infrastructure

26. **[BLOCKER] Private credentials use environment-scoped configuration or a secrets manager**
    - Risk: Hardcoded secrets get committed, pushed, and indexed by GitHub. Rotation is then insufficient.
    - Fix: Store private credentials in protected environment-scoped settings or a secrets manager. Keep them out of Git, client bundles and logs.

27. **[BLOCKER] `.env` not in git history**
    - Risk: `.env` added and later removed is still in git history and accessible via `git log`.
    - Fix: Run `git log -- .env`. If it appears, purge it with `git filter-repo` and rotate every secret in it.

28. **[WARNING] SSL certificate installed and valid**
    - Risk: Expired certificates break your app and expose users to MITM attacks.
    - Fix: Use Let's Encrypt with auto-renewal, or verify your CDN/host handles cert renewal automatically.

29. **[WARNING] Server not running as root**
    - Risk: A compromised process running as root has full system access.
    - Fix: Run your app process as a non-root user. Use Docker's `USER` directive or system user accounts.

30. **[WARNING] Exposed network services match the deployment threat model**
    - Risk: Exposed database ports, admin panels, or debug endpoints are the most common initial attack vector.
    - Fix: Restrict administrative ports and internal data services. Public ports depend on a reviewed platform and access policy.

### Code

31. **[WARNING] Production logs do not expose credentials, personal data or internal secrets**
    - Risk: Logs can leak internal data, tokens, or stack traces to anyone with browser DevTools open.
    - Fix: Review real log payloads and shipped client bundles. Remove sensitive values and unsafe debug data, while preserving sanitized diagnostic logging.

32. **[WARNING] `npm audit` run — all critical and high vulnerabilities resolved**
    - Risk: Known CVEs in your dependencies are public and actively exploited.
    - Fix: Run `npm audit --audit-level=high`. Update or patch vulnerable packages. Review breaking changes.

33. **[WARNING] Dependency lockfile committed to the repository**
    - Risk: Without a lockfile, CI installs different package versions than local dev. Supply chain attacks can slip through version ranges.
    - Fix: Commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Never add lockfiles to `.gitignore`.

34. **[BLOCKER] No hardcoded credentials anywhere in the codebase**
    - Risk: API keys, database URLs, or passwords in source code get pushed, shared, and indexed.
    - Fix: Run `git grep -i "password\|secret\|api_key\|token"` and audit every match.

35. **[WARNING] File uploads validated for type, size, and path**
    - Risk: Unrestricted uploads allow attackers to upload executables, exhaust disk, or escape to arbitrary paths.
    - Fix: Validate MIME type server-side (not just the extension), enforce a size limit, and never use user-supplied filenames as storage paths.

36. **[WARNING] MFA available for apps handling sensitive or financial data**
    - Risk: Password-only auth is the single biggest account takeover vector for high-value targets.
    - Fix: Offer TOTP (Google Authenticator) or passkey-based MFA. For financial or health apps, make it mandatory.

---

## Output Format

After auditing, produce a report in this structure:

```
BLOCKERS (fix before delivery):
- [#] [item name]: [specific fix for their stack]

WARNINGS (fix within 30 days):
- [#] [item name]: [specific fix for their stack]

NOT APPLICABLE:
- [#] [item name]: [reason]

PASSED:
- [count] of [applicable count] items confirmed secure
```

Never issue security readiness if an applicable blocker or critical unknown is unresolved. The specialist audit does not approve production deployment.

---

> Also run the **pre-launch-checklist** to audit infrastructure, load handling, observability, and operations before launch.
