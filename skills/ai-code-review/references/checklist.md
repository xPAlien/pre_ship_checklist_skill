# AI Code Review Checklist

Evaluate every item. Mark `PASS`, `FAIL`, `NEEDS VERIFICATION`, or `NOT APPLICABLE`. Give a one-line reason for every status except `PASS`. Cite items by stable ID: `CR-` plus the item number, for example `CR-3.4`. Keep numbering stable when items change.

Thresholds in this file are starting points for discussion, not universal requirements. Choose values from the system's real traffic, latency budgets, and failure modes.

---

## 1. Comprehension and Intent

| # | Check | Why It Matters |
|---|-------|---------------|
| 1.1 | The reviewer can explain what every function does without reading comments | If you need comments to understand it, you cannot debug it at 3 AM |
| 1.2 | The reviewer can explain why this approach was chosen | AI picks the first viable pattern, not the best one for your context |
| 1.3 | The reviewer can trace the full execution path from entry to exit | Gaps in your mental model become gaps in your incident response |
| 1.4 | Variable and function names reflect business intent, not generic labels | AI defaults to names like `data`, `result`, `handler` which tell you nothing |
| 1.5 | No dead code, unused imports, or commented-out blocks | AI leaves artifacts from prior prompt iterations |

---

## 2. Edge Cases and Error Handling

| # | Check | Why It Matters |
|---|-------|---------------|
| 2.1 | Null, undefined, and empty values are handled at every boundary | AI writes for populated data. Empty arrays, null responses, and missing fields crash production |
| 2.2 | Network calls have timeouts configured | AI omits timeouts. One slow downstream service freezes your entire application |
| 2.3 | Retries use exponential backoff with jitter and a retry limit, and apply only to idempotent operations or requests carrying an idempotency key | Retrying a non-idempotent write such as a payment can duplicate its effect. Retries without backoff amplify an outage |
| 2.4 | Concurrent access is handled (race conditions, deadlocks) | AI writes single-threaded logic. Two users hitting the same endpoint simultaneously exposes the gap |
| 2.5 | Partial failures are handled (what if step 3 of 5 fails?) | AI writes sequential steps assuming all succeed. Real systems fail in the middle |
| 2.6 | External service failures degrade gracefully (circuit breaker pattern) | One broken dependency should not take down your entire system |
| 2.7 | Error messages do not leak internal details (stack traces, DB schemas, file paths) | AI-generated error handlers often dump raw error objects to the response |

---

## 3. Security

| # | Check | Why It Matters |
|---|-------|---------------|
| 3.1 | All user input is validated server-side | AI trusts client-side validation. Attackers bypass it in seconds |
| 3.2 | Database queries use parameterized inputs (no string concatenation) | SQL injection is the oldest vulnerability in the book. AI still generates concatenated queries |
| 3.3 | Authentication checks exist on every protected endpoint | AI builds individual endpoints. It does not check whether your auth middleware covers the new route |
| 3.4 | Authorization checks verify the requesting user has permission for the specific resource | Auth confirms identity. Authz confirms access. AI routinely skips the second one |
| 3.5 | No secrets, API keys, tokens, or credentials are hardcoded | AI embeds placeholder values that become real secrets when the developer fills them in |
| 3.6 | Sensitive data is not logged (passwords, tokens, PII, credit card numbers) | AI-generated logging often dumps entire request/response objects |
| 3.7 | File uploads validate type, size, and content (not just extension) | AI checks file extensions. Attackers rename malware.exe to image.png |
| 3.8 | Rate limiting or quotas exist on public-facing and costly endpoints | AI tools rarely add rate limiting unprompted. Without it, your API is a free resource for abuse and runaway bills |
| 3.9 | CORS, CSP, and security headers match the endpoint's audience | AI-generated APIs often allow every origin, even on credentialed endpoints. A wildcard origin fits only intentionally public, non-credentialed responses |
| 3.10 | New and changed dependencies are audited for known vulnerabilities and verified to exist under the expected name | AI suggests packages from its training data. Those packages change, sometimes get compromised, and sometimes never existed, which invites typosquatting |

---

## 4. Performance and Scalability

| # | Check | Why It Matters |
|---|-------|---------------|
| 4.1 | User-facing inputs that trigger backend calls have debounce or throttle logic | A search box firing a query per keystroke multiplies backend load by the length of every search term |
| 4.2 | Queries on large or growing tables have been checked with EXPLAIN or the database's query plan tool | AI writes correct SQL that performs full table scans on large datasets |
| 4.3 | Indexes exist for columns used in WHERE, JOIN, and ORDER BY | Missing indexes turn millisecond queries into multi-second queries at scale |
| 4.4 | Where caching is used or needed, the strategy is defined (TTL, invalidation rules, cache key structure, no cross-user leakage) | Missing caching sends every request to the database. Careless caching serves one user's data to another |
| 4.5 | Database connections use a pool, not per-request connections | AI opens a new connection per request. At 1,000 concurrent users, the database hits its connection limit |
| 4.6 | N+1 query patterns are eliminated | AI writes loops that fire one query per iteration. 100 items means 101 queries |
| 4.7 | Large data sets use pagination, not full loads | AI loads entire result sets into memory. Fine for 50 records. Fatal for 500,000 |
| 4.8 | Bulk operations use batch processing, not individual calls | AI writes loops of individual inserts/updates. Batch operations are 10x to 100x faster |

---

## 5. Observability

| # | Check | Why It Matters |
|---|-------|---------------|
| 5.1 | Structured logging exists with correlation IDs | When production breaks, you need to trace a request across services. AI adds console.log statements |
| 5.2 | Errors are logged with full context (stack trace, request data, user context) | AI catches errors and swallows them or logs a generic message |
| 5.3 | Performance metrics are tracked (response time, throughput, error rate) | You need to know when things slow down before users tell you |
| 5.4 | Health check endpoints exist for load balancers and monitoring | AI builds features. It does not build the infrastructure to monitor those features |
| 5.5 | Alerts are configured for anomalous behavior | Logging without alerting means nobody sees the problem until users complain |

---

## 6. Architecture Fit

| # | Check | Why It Matters |
|---|-------|---------------|
| 6.1 | The code follows existing project patterns and conventions | AI generates code in isolation. It does not know your project uses a repository pattern or event-driven architecture |
| 6.2 | The code fits within existing service boundaries | AI puts logic wherever it lands. If it belongs in a different service, move it |
| 6.3 | The choice between sync and async processing is intentional | AI defaults to synchronous. Long-running operations should be queued |
| 6.4 | The data consistency model matches the use case | AI does not consider eventual consistency, saga patterns, or distributed transaction trade-offs |
| 6.5 | New dependencies are justified and maintained | AI adds packages for trivial tasks. Every dependency is an attack surface and maintenance burden |

---

## 7. Code Quality

| # | Check | Why It Matters |
|---|-------|---------------|
| 7.1 | Functions do one thing | AI-generated functions tend to be long and handle multiple concerns |
| 7.2 | Test coverage includes unhappy paths (errors, timeouts, invalid input) | AI writes tests for the happy path. Your production bugs live in the unhappy paths |
| 7.3 | Tests are not tautological (testing that the mock returns what you told it to) | AI-generated tests often test the mock, not the code |
| 7.4 | Magic numbers and strings are named constants | AI embeds raw values. When requirements change, you hunt for every occurrence |
| 7.5 | No duplicated logic across files | AI does not know what exists elsewhere in your codebase. It rewrites utility functions from scratch |
