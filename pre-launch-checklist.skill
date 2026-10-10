---
name: pre-launch-checklist
description: "25-point production readiness checklist for web applications before going live. Use this skill whenever the user is about to launch, ship, deploy, or go live with a web application, API, or backend service. Triggers on: going live, about to launch, pre-launch, before I ship, production checklist, ready to deploy, pre-deploy review, is my app ready, launch checklist, save this before you go live, production readiness. Also trigger proactively when a user has just finished building something and is talking about deployment, even if they do not use these exact words."
---

# Pre-Launch Production Checklist

A 25-point checklist covering the failure modes that kill apps in production. Run through every item before you push to prod.

---

## How to Use This Skill

### Step 1 — Collect the stack

Before running any checklist items, inspect repository and provider configuration. Ask only for missing context:

- **Hosting**: Vercel, Railway, Render, AWS, Fly.io, DigitalOcean, other?
- **Backend/API**: Next.js API routes, Express, FastAPI, Django, Rails, other?
- **Database**: Postgres, MySQL, MongoDB, Supabase, PlanetScale, other?
- **Queue/background jobs**: Any queue system, or inline/sync only?
- **Auth**: NextAuth, Supabase Auth, Clerk, custom JWT, other?

Use these answers to tailor every fix to the user's specific stack. For example: "Run migrations as a separate deploy step" means different things on Vercel (use a release command) versus Render (use a pre-deploy script) versus a raw VPS (run before restarting the service).

### Step 2 — Choose a mode

Ask the user:
- **Full audit** — all 25 items (recommended for first launch)
- **Fast scan** — 11 baseline blocker items, marking irrelevant controls NOT APPLICABLE with a reason

Blockers: items 1, 2, 3, 6, 9, 13, 14, 15, 19, 21, 25

### Step 3 — Run the checklist

Present items one at a time. Show progress ("Item X of 25" or "Item X of 9" in fast mode). For each item, record PASS, FAIL, NEEDS VERIFICATION, or NOT APPLICABLE with evidence. Verbal assurance alone does not verify a critical control.

- Applicable failed baseline blockers require correction before release.
- Warning due dates depend on real risk and an accountable owner, not a universal 30-day deadline.
- Unknown critical checks block release. For N/A, record a specific reason.

---

## Applicability and evidence

Baseline blocker and warning labels are screening defaults, not universal architecture mandates. For each item, inspect actual project behavior, code, tests and provider evidence. Static sites need no database, email queue or protected user routes unless they implement these features. Unverified critical checks remain blockers for the main `ship` release decision. Distinguish evidence from user assurances.

## The 25 Items

### Load and Scale

1. **[BLOCKER] Load testing before launch**
   - Risk: You don't know where it breaks until it breaks in production.
   - Fix: Run k6, Locust, or Artillery against staging. Know your breaking point before users do.

2. **[BLOCKER] Session data not stored in server memory**
   - Risk: Works on one instance. Breaks the moment you need two.
   - Fix: Store sessions in Redis or a database. Never in process memory.

3. **[BLOCKER] File uploads go to object storage, not the app server**
   - Risk: Disk fills up. Server dies. Files lost.
   - Fix: Route uploads directly to S3, R2, or GCS on day one.

4. **[WARNING] CDN in front of static assets**
   - Risk: Every image served by your app server. 500 concurrent users = 500 image requests hitting your backend.
   - Fix: Put CloudFront, Cloudflare, or equivalent in front of everything static.

### Database

5. **[WARNING] Read scaling approach is justified by measured database workload**
   - Risk: Unmeasured read bottlenecks can cause latency spikes under load.
   - Fix: Measure query plans, throughput and latency. Apply indexes, cache, pooling or a read replica only when needed.

6. **[BLOCKER] Critical joins and foreign-key lookups perform adequately under expected load**
   - Risk: Unindexed hot joins and filters can cause avoidable latency or locks.
   - Fix: Inspect actual query plans and index frequently joined or filtered columns where justified.

7. **[WARNING] DB migrations do not run automatically on app start**
   - Risk: Two instances deploy at the same time. Both run migrations. Race condition. Data inconsistency.
   - Fix: Run migrations as a separate deploy step before instances start.

8. **[WARNING] Database backups tested with an actual restore**
   - Risk: You have backups. You've never actually restored from one.
   - Fix: Restore to a staging environment today. Verify the data. Schedule recurring restore tests.

9. **[BLOCKER] Multi-step writes use transactions**
   - Risk: Step 1 succeeds. App crashes. Step 2 never runs. Data is now inconsistent permanently.
   - Fix: Wrap every multi-step write in a transaction. Test rollback behavior explicitly.

10. **[WARNING] Search queries are parameterized or use full-text indexes**
    - Risk: Unparameterized search with real data volume = 5-second response times at scale.
    - Fix: Use parameterized queries. Add full-text search indexes for anything user-facing.

### Async and Background Work

11. **[WARNING] Email sending has reliable delivery and bounded request latency**
    - Risk: Slow email provider = slow API response for every request that triggers one.
    - Fix: Use durable queues when provider latency or retries threaten the user flow. For small bounded calls, strict timeouts may suffice.

12. **[WARNING] Slow or retryable jobs use appropriate asynchronous execution**
    - Risk: Everything is blocking. One slow task pauses everything behind it.
    - Fix: Queue work when product latency budgets, reliability, or retries require it. Choose an execution model supported by the host.

### Resilience

13. **[BLOCKER] No hardcoded secrets in deployment scripts or CI config**
    - Risk: Secrets sitting in your CI logs. Visible to anyone with pipeline access.
    - Fix: Use environment variables or a secrets manager. Audit your CI logs now.

14. **[BLOCKER] Rate limiting is configured**
    - Risk: 500 users. One of them is a bot. Your server is now a bot server.
    - Fix: Add rate limiting at the edge (Cloudflare) or at the API layer (Upstash Redis).

15. **[BLOCKER] All outbound HTTP calls have connection timeouts set**
    - Risk: External API hangs. Your thread hangs with it. Indefinitely.
    - Fix: Set connect and read timeouts on every outbound HTTP call. No exceptions.

16. **[WARNING] Circuit breakers exist on external service calls**
    - Risk: External service is slow. Your thread pool fills waiting for it. Everything queues.
    - Fix: Implement circuit breakers (Hystrix, resilience4j, or a simple counter-based pattern).

17. **[WARNING] Fallback exists for critical third-party API dependencies**
    - Risk: That API goes down. Your core feature goes down with it.
    - Fix: Build a graceful degradation path. At minimum, show a clear error instead of a broken page.

18. **[WARNING] WebSockets are handled by a stateful service**
    - Risk: Horizontal scaling breaks real-time features. Every user gets disconnected.
    - Fix: Use a stateful WebSocket service (Socket.IO with Redis adapter, Ably, Pusher).

### Observability

19. **[BLOCKER] Error alerting is configured**
    - Risk: App crashes at 3 AM. You find out when a user emails you at 9 AM.
    - Fix: Set up Sentry, Datadog, or PagerDuty. Alert on error rate spikes, not just downtime.

20. **[WARNING] Logs are written to a centralized service, not local disk**
    - Risk: Logs rotate off. Incident happens. No history to debug with.
    - Fix: Ship logs to Datadog, Logtail, CloudWatch, or equivalent from day one.

21. **[BLOCKER] An appropriate production health signal exists for the release unit**
    - Risk: Load balancer sends traffic to crashed instances. Users get 502s.
    - Fix: Use host-native health checks or a minimal readiness endpoint as appropriate. Do not expose sensitive configuration or full dependency internals.

22. **[WARNING] API responses are compressed**
    - Risk: JSON payloads sent uncompressed. 10x the bandwidth they need to use.
    - Fix: Enable gzip or brotli compression at the server or CDN level.

### Operations

23. **[WARNING] Graceful shutdown is implemented**
    - Risk: Deploy kills active requests. Users mid-action get errors with no retry.
    - Fix: Handle SIGTERM. Drain in-flight requests before shutting down.

24. **[WARNING] Memory leak detection or limits are in place for long-running processes**
    - Risk: Memory grows slowly. Server hits 100%. Everything grinds to a halt. Restart. Repeat.
    - Fix: Set memory limits. Add heap profiling. Monitor RSS over time in your observability tool.

25. **[BLOCKER] An incident and rollback runbook covers applicable operational risks**
    - Risk: Something breaks at 2 AM. Nobody knows what to do. Everyone panics.
    - Fix: Document the 5 most likely failure modes and the exact steps to recover from each.

---

## Output Format

After auditing, produce a report in this structure:

```
BLOCKERS (must fix before launch):
- [#] [item name]: [specific fix for their stack]

WARNINGS (fix within 30 days):
- [#] [item name]: [specific fix for their stack]

NOT APPLICABLE:
- [#] [item name]: [reason]

PASSED:
- [count] of [applicable count] items confirmed ready
```

Never issue a GO verdict if an applicable blocker or critical unknown is unresolved. The specialist audit does not approve production deployment.

---

> Also run the **vibe-coder-security-checklist** to audit authentication, API security, and application-layer vulnerabilities before launch.
