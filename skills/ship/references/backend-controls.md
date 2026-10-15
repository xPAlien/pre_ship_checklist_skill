# Backend release controls | v0.5.0

These 25 controls map the three supplied screenshots into the existing eight Ship gates. They supplement, rather than replace, the original 40 source items in [source-mapping.md](source-mapping.md). The combined source inventory is 65 items, not 65 unique security controls. Reuse evidence for overlapping risks and issue one finding per root cause.

Read [backend-review.md](backend-review.md) before evaluating these controls. Inspect every row for applicability. Record `PASS`, `FAIL`, `NEEDS VERIFICATION`, or `NOT APPLICABLE`, plus evidence or a specific exclusion reason. Apply the central Ship P0 to P3 policy. An applicable critical unknown remains `NO-GO`. Missing dashboard access is not evidence of a missing control.

The control and evidence columns are this toolkit's review requirements. Source references support the technical corrections. They do not establish the user's provider settings.

## 1. Keys and access

| ID | Source topic | Existing checks | Control and required evidence |
| --- | --- | --- | --- |
| BE-01 | Server-only private keys | G1-01, G1-02 | Scan tracked source, available Git history, generated browser bundles, source maps, and deployment exposure. Distinguish public publishable keys from private credentials. Report only file path, line, commit, or dashboard location, never the value. Exposure requires an approved revocation or rotation record. Source deletion alone is insufficient. [S1] [S2] |
| BE-02 | Server authentication, permissions, validation | G1-03, G1-04, G1-05 | Inventory protected endpoints, server actions, and functions. Test anonymous, wrong-user, wrong-tenant, wrong-role, and malformed requests with synthetic identities. Public endpoints need explicit policy. Payment webhooks authenticate the provider, not a browser session. [S3] [S4] |
| BE-03 | Row-level security or equivalent rules | G2-01, G1-12 | Verify isolation through RLS, provider security rules, or a documented server-only authorization boundary. Test reads and writes with the actual runtime role. In PostgreSQL, inspect table ownership and BYPASSRLS because privileged roles bypass policies. Preserve intentional organization sharing. Do not enable RLS blindly. [S5] |
| BE-04 | Private uploads and expiring links | G2-07, G1-08 | Keep private user objects non-public. Test anonymous and cross-tenant access, signed-link expiry, operation scope, and authorization before issuing a URL. Signed URLs are bearer credentials, not inherently single-use. Avoid logging them. Deliberately public assets follow a separate approved policy. [S6] |
| BE-05 | Secure login cookies | G1-06 | Inspect real browser responses for HttpOnly and Secure on session cookies. Verify suitable SameSite, expiry, domain/path scope, CSRF defenses, and social-login compatibility. Token-only APIs need a separate documented session threat model, not invented cookies. [S7] |
| BE-06 | Sensitive-data-free logs | G1-01, G1-10 | Inspect server, browser, worker, webhook, and error-monitoring payloads. Test redaction with fake credentials. Exclude passwords, tokens, API keys, signed URLs, and unnecessary personal data from normal and failure paths. Evidence includes sanitized output, never a leaked value. [S8] |

## 2. Cost and abuse

| ID | Source topic | Existing checks | Control and required evidence |
| --- | --- | --- | --- |
| BE-07 | Spending caps or alerts | G6-08 | Inventory metered AI, SMS, email, hosting, storage, and queue services. Record approved budgets, enforcement scope, alert recipients, and stop behavior. Distinguish alerts from enforced caps. Verify provider delays and availability tradeoffs. Test application-side limits with mocks. Never invent spending thresholds or enable project pausing without approval. [S9] [S10] |
| BE-08 | Endpoint limits and daily AI quotas | G1-07, G6-08 | Review signup, login, code-send, code-verify, and reset limits. Check per-user, tenant, and aggregate budgets, concurrency, retries, and AI input/output limits. Exercise concurrent requests and limiter failure. Quota accounting must resist races. Approved limits and failure policy are required before a critical paid path passes. [S9] |
| BE-09 | Upload size and type limits | G1-05, G1-08 | Check limits before expensive processing. Test actual byte limits, allowed content signatures, spoofed MIME types, unsafe names, decompression expansion, and processing timeouts. Browser validation and file extensions alone are insufficient. Use non-executable storage and malware screening where the threat model requires it. [S11] |
| BE-10 | Signup challenges and free-credit eligibility | G1-07, G3-02 | Use risk-based bot defenses rather than mandatory CAPTCHA on every product. Where a challenge exists, verify it server-side and test replay and failure. Confirm approved eligibility before issuing free credits. Test repeated signup and concurrent credit claims. Email verification proves mailbox control, not a unique person or absence of automation. [S3] [S9] |

## 3. Payments and entitlements

| ID | Source topic | Existing checks | Control and required evidence |
| --- | --- | --- | --- |
| BE-11 | Payment webhook signatures | G1-08, G2-08 | Verify the unmodified raw body with the provider SDK, correct endpoint secret, and replay-time policy. Test missing or invalid signatures, tampered bodies, stale requests, and wrong environment or account. Reject before any business effect. Record tests against the deployed SDK/API contract. [S4] |
| BE-12 | Duplicate payment webhooks | G2-06, G2-08 | Test duplicate, concurrent, retried, and out-of-order deliveries. Use durable uniqueness and atomic state transitions. A received-event record is not proof of completed processing. Test a crash between receipt and effect. Acknowledge only after durable acceptance or completed processing. External effects need an outbox or equivalent idempotent recovery. [S4] |
| BE-13 | Server-authoritative amounts | G2-08, G3-03 | Resolve allowed products, prices, currency, quantity, tax, and discounts from trusted server/provider state. Bind checkout to the authorized account. Test altered amounts, price IDs, ownership, and forged success redirects. Reconcile verified payment state before granting access. [S12] [S20] |
| BE-14 | Payment lifecycle tests | G3-03, G2-08 | Use a verified sandbox or test-mode account with synthetic data only. Cover success, failed charge, required authentication, delayed payment, refund, cancellation now and at period end, renewal, and replay as applicable. Compare provider state, local records, and access. Record excluded paths with reasons. Never run real charges or refunds for this audit. [S13] [S14] |
| BE-15 | Trial and subscription expiry | G2-08, G3-03 | Evaluate a documented entitlement state machine. Respect paid-through dates and approved grace periods. Do not revoke early for period-end cancellation or assume one failed invoice ends access. Test expiry, missed-event reconciliation, stale sessions/caches, and late events without regranting expired access. Apply refund policy explicitly. [S14] [S15] |

## 4. Failures and recovery

| ID | Source topic | Existing checks | Control and required evidence |
| --- | --- | --- | --- |
| BE-16 | Error monitoring | G6-06 | Confirm actionable error alerts reach a named operator. Use a safe non-production synthetic failure or recent verified alert evidence. Record routing, response ownership, and sanitized context. Installing an SDK alone does not pass the check. |
| BE-17 | Backups and tested restore | G2-04, G2-05 | Set acceptable data loss and recovery time with the owner. Verify schedule, retention, encryption, and restore evidence against those objectives. Daily backups are not a universal target. Restore only to an approved disposable non-production destination. Do not export customer data for testing. No restore evidence means NEEDS VERIFICATION. |
| BE-18 | Failed or missed scheduled jobs | G6-09, G6-06 | Check failure, timeout, missed-run, and stale-output alerts. Inspect last-success timestamps, expected cadence, queue lag, retry limits, and poison-job handling. Test a missing heartbeat as well as an explicit failure without interrupting a production job. |
| BE-19 | External uptime monitoring | G6-06, G6-11 | Verify an outside-in probe reaches the intended production domain and meaningful health path. Record cadence, confirmation delay, alert delivery, and escalation owner. Do not promise instant detection or induce a live outage. Use a safe test endpoint or recent drill evidence. |
| BE-20 | Stop an abusive account | G1-13, G1-07 | Verify a protected, auditable suspension workflow through an admin UI or equivalent operator tool. Test suspension, reversal, and role denial with seeded non-production identities. Check existing sessions, API tokens, queued work, and paid calls. A browser-only ban fails. Real-account suspension requires separate approval. |

## 5. Launch operations

| ID | Source topic | Existing checks | Control and required evidence |
| --- | --- | --- | --- |
| BE-21 | Debug mode and test-data cleanup | G1-13, G7-02 | Verify production debug flags and test-only routes are disabled. Produce a read-only cleanup manifest with exact account/record IDs, fixture provenance, environment, retention impact, and proposed action. Names or email patterns are not proof. Preserve approved synthetic monitors. Never automatically delete accounts or data. |
| BE-22 | Live payment configuration | G6-02, G7-03 | Inspect account, mode, server/public key pairing, live catalog IDs, endpoint registration, signing-secret presence, and API version without exposing values. Test and live objects and credentials are separate. Record the operator's cutover steps. Do not switch modes, replace keys, or enable live payments during an audit. [S2] [S4] |
| BE-23 | Provider administrator MFA | G1-12, G6-01 | Verify MFA or equivalent enforced SSO policy for payment, hosting, database, registrar, and source-control administrators. Check recovery ownership and least privilege. Never retrieve recovery codes or alter enrollment. Missing dashboard evidence remains unverified. [S3] [S16] |
| BE-24 | Domain and certificate renewal | G6-04 | Verify registrar renewal policy, billing ownership, expiry alerts, and a fallback operator. Separately verify certificate management and renewal prerequisites. For Vercel-managed TLS, inspect provider status and DNS instead of inventing a certificate auto-renew toggle. Do not change billing or DNS. [S17] [S18] |
| BE-25 | Dependency security | G1-11, G0-04 | Review a current advisory scan for the actual lockfile and deployment graph. Record affected versions, reachability, exploitability, and smallest correction. Security-critical exposure blocks release under Ship policy. No blanket upgrade or `npm audit fix --force`. Review and retest any approved update. Scanner failure is not a clean result. [S19] |

## Primary documentation

Technical references checked 2026-10-12. Recheck changing provider behavior during each audit. The screenshots are input requirements, not authoritative documentation. Operational acceptance criteria without a source marker are this toolkit's explicit review policy.

[S1]: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
[S2]: https://docs.stripe.com/keys
[S3]: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
[S4]: https://docs.stripe.com/webhooks
[S5]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
[S6]: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
[S7]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[S8]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
[S9]: https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
[S10]: https://vercel.com/docs/spend-management
[S11]: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
[S12]: https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted
[S13]: https://docs.stripe.com/testing
[S14]: https://docs.stripe.com/billing/subscriptions/webhooks
[S15]: https://docs.stripe.com/billing/subscriptions/cancel
[S16]: https://docs.stripe.com/security/guide
[S17]: https://vercel.com/docs/domains/working-with-ssl
[S18]: https://vercel.com/docs/domains/working-with-domains/renew-a-domain
[S19]: https://docs.npmjs.com/cli/v11/commands/npm-audit/
[S20]: https://docs.stripe.com/payments/advanced/dynamically-update-amounts?payment-ui=elements
