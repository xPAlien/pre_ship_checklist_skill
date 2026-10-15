# Common AI Code Failures

These patterns show up often in AI-generated code. Check for them first when
reviewing a change. Each maps to a checklist item. The numbers in each fix are
starting points. Tune them to your traffic, latency budgets, and providers.

---

## 1. Missing Debounce on User Input (CR-4.1)

AI writes event handlers that fire on every keystroke, mouse move, or scroll event.
At low traffic this is invisible. At scale it saturates your backend.

Bad pattern:
```javascript
searchInput.addEventListener('input', async (e) => {
  const results = await fetch(`/api/search?q=${e.target.value}`);
  displayResults(await results.json());
});
```

Fix: Debounce input-driven requests. 300 to 500ms is a common starting point for
search. Use throttle for scroll events. Cancel stale in-flight requests.

---

## 2. No Connection Pooling (CR-4.5)

AI creates a new database connection per request. This works for a single developer
testing locally. At 500 concurrent users, the database rejects new connections.

Bad pattern:
```python
def get_user(user_id):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    return cursor.fetchone()
```

Fix: Use a connection pool. Set max pool size below your database's connection limit.
On serverless platforms, use the provider's pooler or a serverless driver, because each
function instance holds its own pool. Monitor pool exhaustion.

---

## 3. N+1 Query Pattern (CR-4.6)

AI writes a query to get a list, then loops through results making one query per
item. 100 items = 101 queries.

Bad pattern:
```python
orders = db.query("SELECT * FROM orders WHERE user_id = ?", user_id)
for order in orders:
    items = db.query("SELECT * FROM order_items WHERE order_id = ?", order.id)
    order.items = items
```

Fix: Use a JOIN or a single IN query to fetch all related records in one call.

---

## 4. Swallowed Errors (CR-5.2)

AI wraps code in try/catch and either logs nothing or logs a generic message. The
error disappears. Production fails silently.

Bad pattern:
```javascript
try {
  await processPayment(order);
} catch (error) {
  console.log("Something went wrong");
}
```

Fix: Log the full error with stack trace, request context, and correlation ID.
Decide explicitly whether to retry, fail loudly, or degrade gracefully.

---

## 5. String-Concatenated SQL (CR-3.2)

AI still generates SQL with string interpolation despite parameterized queries
being available in every language. This is a direct SQL injection vulnerability.

Bad pattern:
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
```

Fix: Use parameterized queries. No exceptions. Ever.

---

## 6. Hardcoded Secrets (CR-3.5)

AI places API keys, database URLs, and tokens directly in source code. The
developer fills in real values and commits them to version control.

Bad pattern:
```python
API_KEY = "sk-live-abc123..."
```

Fix: Use environment variables at minimum. Use a secrets manager in production.
Run secret scanning in CI. If a real secret was committed, the owner rotates it.
Deleting it from the source does not revoke it.

---

## 7. Missing Authorization Checks (CR-3.4)

AI adds authentication (who are you?) but skips authorization (are you allowed to
access this specific resource?). User A fetches User B's data by changing an ID
in the URL.

Bad pattern:
```python
@require_auth
def get_document(request, doc_id):
    return Document.objects.get(id=doc_id)  # No check: does this user own this doc?
```

Fix: Every data access must verify the requesting user has permission for that
specific resource. Filter queries by user ID or check ownership explicitly.

---

## 8. No Rate Limiting (CR-3.8)

AI tools rarely add rate limiting unprompted. Your API becomes a free resource for
scrapers, bots, and abusers, and paid endpoints such as AI calls turn abuse into a bill.

Fix: Add rate limiting at the edge or API gateway (for example Vercel Firewall
rate-limit rules) and per-user quotas in the application. Set limits from expected
usage per endpoint. Login, signup, and AI endpoints usually need tighter limits.

---

## 9. Permissive CORS (CR-3.9)

AI-generated APIs often ship with Access-Control-Allow-Origin set to wildcard, even
on endpoints that use cookies or other credentials.

Bad pattern:
```python
CORS(app, resources={r"/*": {"origins": "*"}})
```

Fix: Restrict credentialed endpoints to your known origins and test real browser
requests. A wildcard origin fits only intentionally public, non-credentialed
responses, such as a public read-only API.

---

## 10. No Timeout on External Calls (CR-2.2)

AI makes HTTP calls to external services with no timeout. If the external service
hangs, your request hangs. Your thread pool fills up. Your application stops
responding.

Bad pattern:
```python
response = requests.get("https://external-api.com/data")
```

Fix: Set explicit connect and read timeouts on every external call, sized to your
latency budget and below your platform's function time limit. Retry only idempotent
calls (CR-2.3). Add circuit breaker logic for repeated failures.
