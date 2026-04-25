---
name: pre-launch-checklist
description: "25-point production readiness checklist for web applications before going live. Use this skill whenever the user is about to launch, ship, deploy, or go live with a web application, API, or backend service. Triggers on: going live, about to launch, pre-launch, before I ship, production checklist, ready to deploy, pre-deploy review, is my app ready, launch checklist, save this before you go live, production readiness. Also trigger proactively when a user has just finished building something and is talking about deployment, even if they do not use these exact words."
---

# Pre-Launch Production Checklist

A 25-point checklist covering the failure modes that kill apps in production. Go through every item before you push to prod.

---

## How to Use This Skill

Present the checklist as an interactive audit. For each item, ask the user to confirm yes, no, or not applicable. Flag all "no" answers as blockers. Group blockers by severity at the end.

If the user pastes their stack or describes their app, tailor the checklist items to their specific tech (e.g., if they use Node.js, call out Node-specific memory leak patterns).

---

## The 25 Items

### Load and Scale

1. **Load testing before launch**
   - Risk: You don't know where it breaks until it breaks in production.
   - Fix: Run k6, Locust, or Artillery against staging. Know your breaking point before users do.

2. **Session data not stored in server memory**
   - Risk: Works on one instance. Breaks the moment you need two.
   - Fix: Store sessions in Redis or a database. Never in process memory.

3. **File uploads go to object storage, not the app server**
   - Risk: Disk fills up. Server dies. Files lost.
   - Fix: Route uploads directly to S3, R2, or GCS on day one.

4. **CDN in front of static assets**
   - Risk: Every image served by your app server. 500 concurrent users = 500 image requests hitting your backend.
   - Fix: Put CloudFront, Cloudflare, or equivalent in front of everything static.

### Database

5. **Database read replica exists**
   - Risk: All reads and writes hit one machine. First real traffic spike kills query performance.
   - Fix: Add a read replica. Route read-heavy queries there.

6. **All foreign key columns are indexed**
   - Risk: Every JOIN is a full table scan. Slow at 100 rows. Broken at 100,000.
   - Fix: Index every foreign key. Run EXPLAIN on your slowest queries now.

7. **DB migrations do not run automatically on app start**
   - Risk: Two instances deploy at the same time. Both run migrations. Race condition. Data inconsistency.
   - Fix: Run migrations as a separate deploy step before instances start.

8. **Database backups tested with an actual restore**
   - Risk: You have backups. You've never actually restored from one.
   - Fix: Restore to a staging environment today. Verify the data. Schedule recurring restore tests.

9. **Multi-step writes use transactions**
   - Risk: Step 1 succeeds. App crashes. Step 2 never runs. Data is now inconsistent permanently.
   - Fix: Wrap every multi-step write in a transaction. Test rollback behavior explicitly.

10. **Search queries are parameterized or use full-text indexes**
    - Risk: Unparameterized search with real data volume = 5-second response times at scale.
    - Fix: Use parameterized queries. Add full-text search indexes for anything user-facing.

### Async and Background Work

11. **Email sending is offloaded to a queue**
    - Risk: Slow email provider = slow API response for every request that triggers one.
    - Fix: Push email jobs to a queue (BullMQ, Sidekiq, SQS). Never send inline.

12. **Background tasks run in a queue, not blocking the request cycle**
    - Risk: Everything is blocking. One slow task pauses everything behind it.
    - Fix: Use a job queue for any task that takes more than 200ms.

### Resilience

13. **No hardcoded secrets in deployment scripts or CI config**
    - Risk: Secrets sitting in your CI logs. Visible to anyone with pipeline access.
    - Fix: Use environment variables or a secrets manager. Audit your CI logs now.

14. **Rate limiting is configured**
    - Risk: 500 users. One of them is a bot. Your server is now a bot server.
    - Fix: Add rate limiting at the edge (Cloudflare) or at the API layer (Upstash Redis).

15. **All outbound HTTP calls have connection timeouts set**
    - Risk: External API hangs. Your thread hangs with it. Indefinitely.
    - Fix: Set connect and read timeouts on every outbound HTTP call. No exceptions.

16. **Circuit breakers exist on external service calls**
    - Risk: External service is slow. Your thread pool fills waiting for it. Everything queues.
    - Fix: Implement circuit breakers (Hystrix, resilience4j, or a simple counter-based pattern).

17. **Fallback exists for critical third-party API dependencies**
    - Risk: That API goes down. Your core feature goes down with it.
    - Fix: Build a graceful degradation path. At minimum, show a clear error instead of a broken page.

18. **WebSockets are handled by a stateful service**
    - Risk: Horizontal scaling breaks real-time features. Every user gets disconnected.
    - Fix: Use a stateful WebSocket service (Socket.IO with Redis adapter, Ably, Pusher).

### Observability

19. **Error alerting is configured**
    - Risk: App crashes at 3 AM. You find out when a user emails you at 9 AM.
    - Fix: Set up Sentry, Datadog, or PagerDuty. Alert on error rate spikes, not just downtime.

20. **Logs are written to a centralized service, not local disk**
    - Risk: Logs rotate off. Incident happens. No history to debug with.
    - Fix: Ship logs to Datadog, Logtail, CloudWatch, or equivalent from day one.

21. **Health check endpoint exists**
    - Risk: Load balancer sends traffic to crashed instances. Users get 502s.
    - Fix: Build a /health endpoint that checks DB connectivity and returns 200 when healthy.

22. **API responses are compressed**
    - Risk: JSON payloads sent uncompressed. 10x the bandwidth they need to use.
    - Fix: Enable gzip or brotli compression at the server or CDN level.

### Operations

23. **Graceful shutdown is implemented**
    - Risk: Deploy kills active requests. Users mid-action get errors with no retry.
    - Fix: Handle SIGTERM. Drain in-flight requests before shutting down.

24. **Memory leak detection or limits are in place for long-running processes**
    - Risk: Memory grows slowly. Server hits 100%. Everything grinds to a halt. Restart. Repeat.
    - Fix: Set memory limits. Add heap profiling. Monitor RSS over time in your observability tool.

25. **A runbook exists for common incidents**
    - Risk: Something breaks at 2 AM. Nobody knows what to do. Everyone panics.
    - Fix: Document the 5 most likely failure modes and the exact steps to recover from each.

---

## Output Format

After auditing, produce a report in this structure:

```
BLOCKERS (must fix before launch):
- [item number] [item name]: [specific fix for their stack]

WARNINGS (fix within 30 days):
- [item number] [item name]: [specific fix for their stack]

PASSED:
- [count] of 25 items confirmed ready
```

Severity classification:
- Blocker: items 1, 2, 3, 6, 9, 13, 14, 15, 19, 21, 25
- Warning: all others

Never tell the user they are "ready to launch" if any blocker items are unresolved.
