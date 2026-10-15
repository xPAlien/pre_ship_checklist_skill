# Ship Audit Checklist | v0.5.0

Every check needs a status, evidence source, and an owner when unresolved. `NOT APPLICABLE` needs an explicit project-specific reason. These are evaluation requirements, not instructions to install every third-party service.

## G0 | Release identity and change control

| ID | Verification | Evidence |
| --- | --- | --- |
| G0-01 | Identify repository, commit SHA, target environment, domain, release approver, and deployment trigger. | Git status, SHA, CI and host configuration |
| G0-02 | Review all release changes, migrations, dependency additions, and generated code. | PR diff, dependency lockfile, migrations |
| G0-03 | Verify CI, type checks, lint, unit tests, build, and any required release checks on candidate SHA. | Executed commands and CI runs |
| G0-04 | Check committed lockfile, reproducible installation, package and runtime version requirements. | Lockfile, build logs, runtime manifests |
| G0-05 | Check the release branch, branch protection, code review and required approvals. | Repository settings and PR evidence |
| G0-06 | Verify dependency and license posture, production feature flags, and unfinished functionality exposure. | Scanner reports, manifest, feature configuration |
| G0-07 | Document owner and runbook for deployment, failure decisions, and escalation. | Release plan |
| G0-08 | Verify release-blocking CI status checks and branch protection where the project uses automated deployments. The skill itself does not enforce a deploy block. | Git provider rules and deployment trigger test |

## G1 | Security and trust boundaries

| ID | Verification | Evidence |
| --- | --- | --- |
| G1-01 | Keep private secrets out of client code, public runtime variables, committed files, generated bundles, and logs. Distinguish intentionally public publishable keys. | Secret scanning, bundle inspection, runtime behavior |
| G1-02 | Investigate exposed keys in Git history or logs. Rotate compromised credentials through approved owner process. Never declare an exposed key safe after source deletion alone. | Secret scanner, incident and rotation record |
| G1-03 | Enforce authentication on protected server endpoints, server actions, webhooks, functions, and data operations. | Direct unauthorized HTTP tests |
| G1-04 | Enforce object and tenant authorization on every resource reference. Test horizontal and vertical privilege escalation with test accounts. | Negative tests using two tenants and roles |
| G1-05 | Validate input on the server. Reject malformed or oversized payloads and handle injection and output encoding appropriately. | Validation tests, code review |
| G1-06 | Review cookies and sessions for secure flags, expiration, CSRF defenses where needed, and logout or revocation correctness. | Browser and API tests |
| G1-07 | Bound abuse with appropriate rate limits, quotas, request size limits, job limits, and endpoint-specific budgets. | Config plus controlled negative tests |
| G1-08 | Restrict CORS, redirects, outbound URLs, file uploads, and webhook verification. Review SSRF and path traversal risks. | Policy review and controlled tests |
| G1-09 | Review HTTPS, CSP, frame policy, content type handling, referrer policy, and other applicable security headers. Test CSP before enforcement. | Observed HTTP response headers |
| G1-10 | Prevent production errors from revealing stack traces, credentials, tenant IDs, internal paths, or sensitive records. | Error-path test and safe logging review |
| G1-11 | Check direct and transitive dependencies, lockfile, and high-severity advisories with a documented risk assessment. | Dependency audit, advisory date |
| G1-12 | Limit database, storage, cloud, CI, and integration permissions. Verify separate environment identities. | Roles, permissions, environment review |
| G1-13 | Ensure admin, debug, test, health, and diagnostics endpoints do not expose privileged state. | Direct endpoint tests |
| G1-14 | For AI or agent systems, test prompt injection, tool-use authorization, output validation, external data boundaries, and confidential data handling. | Threat model, injection and permission tests |
| G1-15 | Verify audit evidence and server authorization around dangerous or irreversible AI actions. | Negative approval-bypass tests |

## G2 | Data integrity and recovery

| ID | Verification | Evidence |
| --- | --- | --- |
| G2-01 | Review data model, tenant isolation, database roles, and row-level security when part of the architecture. | Schema, policies, query/tenant tests |
| G2-02 | Test database migrations on a production-like non-production copy with synthetic or sanitized data. | Migration execution results |
| G2-03 | Prefer backwards-compatible expand/migrate/contract migrations. Document schema compatibility with the prior app revision. | Migration diff, rollback compatibility plan |
| G2-04 | Confirm backup schedules, retention, recovery owner, and a verified restore test suitable for the system's risk. | Provider evidence and restore drill |
| G2-05 | Document point-in-time recovery or data repair options when relevant. Avoid destructive live rollbacks. | Recovery runbook |
| G2-06 | Test idempotency, retries, timeouts, webhook replay defenses, and duplicate prevention for jobs, payment, and email side effects. | Integration and failure-injection tests |
| G2-07 | Check storage access policies, retention, deletion, encryption, signed URLs, and orphan cleanup where applicable. | Storage policy and negative access tests |
| G2-08 | Verify payment state from signed provider events, not client success messages. Exercise cancellation, failure, refund, and duplicate callback paths. | Non-production payment tests |

## G3 | Correctness and accessible UX

| ID | Verification | Evidence |
| --- | --- | --- |
| G3-01 | Test the product's primary user journeys end-to-end in an environment matching the release. | Browser/API test runs and recordings |
| G3-02 | Test account signup, sign-in, session expiration, password or account recovery, and social login if present. | Authorized test accounts and E2E results |
| G3-03 | Test payments, invoices, subscriptions, and webhook behavior if present. | Payment sandbox and negative-path results |
| G3-04 | Verify loading, empty, failure, retry, offline, and unauthorized states without broken UI or information leaks. | Browser and API observations |
| G3-05 | Render usable not-found and server-error states for browser apps. Return correct HTTP 404 and 5xx statuses. APIs need suitable machine-readable errors instead. | HTTP status and rendered response |
| G3-06 | Validate forms: labels, required fields, server-side validation, helpful errors, double-submit prevention, and success confirmation. | Keyboard and negative-path test |
| G3-07 | Check keyboard navigation, focus visibility and order, screen-reader naming, contrast, and reduced-motion preference. Aim for WCAG 2.2 AA as the review baseline. | Automated accessibility checks plus manual verification |
| G3-08 | Give informative images meaningful alt text. Use empty alt text for purely decorative images. Add text alternatives for functional icons and charts. | Component and screen-reader inspection |
| G3-09 | Test links, navigation, deep linking, redirects, browser back, refresh, and session restoration. | Route and browser tests |
| G3-10 | Verify actual email delivery for transactional paths with configured sender identity, SPF, DKIM, DMARC, and monitored failures. Inbox placement is not guaranteed. | DNS and test-message evidence |
| G3-11 | Provide a working contact or support path appropriate to the product. Avoid exposing a personal home address without a requirement. | Form/email response test |
| G3-12 | Check successful submission confirmation or thank-you state when the workflow requires it. | Form flow test |

## G4 | Performance, mobile UX, and resilience

| ID | Verification | Evidence |
| --- | --- | --- |
| G4-01 | Test relevant viewports including 320, 375, 390, 768, 1024, and 1440 pixels. Adapt for the actual audience. | Browser screenshots and interaction checks |
| G4-02 | Test a constrained Android-class device profile, slow network, touch targets, keyboard, and low-memory load. | Device simulation or physical-device results |
| G4-03 | Check overflow, clipped actions, modal scroll, fixed headers and overlays, safe-area spacing, and zoom up to 200 percent. | Manual responsive test |
| G4-04 | Optimize media dimensions, modern formats, responsive sources, offscreen lazy loading, and layout reservation. | Network waterfall, image inspection |
| G4-05 | Control bundle size, unused scripts, blocking third parties, caching, fonts, and unnecessary API calls. | Build analyzer or waterfall evidence |
| G4-06 | Target LCP at or below 2.5s, INP at or below 200ms, CLS at or below 0.1 at p75 in field data once available. Lab results serve as pre-release proxies, not field proof. | RUM or CrUX plus labeled Lighthouse lab data |
| G4-07 | Verify error handling under failed network calls, rate-limit responses, and slow backend behavior. | Failure-injection test |
| G4-08 | A sticky mobile CTA is optional for conversion-oriented pages. If used, test that it never obscures content or controls. | Mobile UX observation |
| G4-09 | Place a clear above-the-fold CTA on conversion-oriented pages where the design calls for one. Do not add CTAs to unrelated flows. | Page-specific UX review |

## G5 | Search, brand, privacy, and legal

| ID | Verification | Evidence |
| --- | --- | --- |
| G5-01 | Give public indexable pages descriptive titles and useful unique descriptions, or documented programmatic equivalents. Exclude auth-only and API pages. | Rendered head elements by representative URL |
| G5-02 | Verify canonical URLs, redirects, language tags if applicable, indexing policy, and avoidance of staging URL indexing. | Rendered tags and HTTP response headers |
| G5-03 | Publish robots.txt and sitemap.xml for eligible public content sites. Include only public canonical URLs in the sitemap. Never treat robots.txt as an access control. | Live routes and sitemap validation |
| G5-04 | Supply favicon and representative Open Graph image for public pages. Verify URLs resolve and shared previews have correct title, image, and description. | HTTP responses, sharing debugger where available |
| G5-05 | Ensure public image descriptions and accessible branding remain accurate. | Page and component review |
| G5-06 | Determine whether a privacy notice is required from actual data processing, audience, and jurisdiction. Verify published notice against real processors and retention. | Data inventory, legal review, published policy |
| G5-07 | Determine whether Terms of Service, commerce notices, refunds, and consumer disclosures apply. Have qualified reviewers assess sensitive claims. | Product facts and approved legal content |
| G5-08 | Determine cookie or tracking consent requirements. Never activate nonessential trackers before required consent. Verify reject, accept, reopen, and preference persistence. | Browser storage, network requests, consent tests |
| G5-09 | Verify stated contact information, accessibility and support methods, and any physical address required by the actual business or law. | Public content and communication test |
| G5-10 | Check content ownership, third-party asset and font licenses, permissions, and required attribution. | License records and content inventory |
| G5-11 | Evaluate age eligibility, children's privacy, regulated data, accessibility obligations, and geographic restrictions only when the product triggers those obligations. | Audience review and specialist decision |
| G5-12 | Confirm analytics collection fits the privacy design. Validate event accuracy without collecting unnecessary identifiers. | Consent-aware live or staging event proof |
| G5-13 | Audit third-party fonts, pixels, session replay, embedded widgets, and support tools. Check regional notice or consent requirements and mask sensitive fields in replay tools. | Network requests, consent and replay settings |
| G5-14 | Verify retention, export, account deletion, and privacy request handling where required by data practices and applicable law. | Data flow review and test procedures |

## G6 | Hosting, operations, and financial controls

| ID | Verification | Evidence |
| --- | --- | --- |
| G6-01 | Confirm host, project/account, production branch or promotion path, and release approver. | Host settings and repo integration |
| G6-02 | Separate dev, preview, and production secrets, databases, storage, webhook destinations, and payment modes. | Provider configuration with values redacted |
| G6-03 | Verify deployment protection, allowed audiences, public domain routing, and unauthorized visitor behavior. | Incognito and authorized access tests |
| G6-04 | Check DNS, HTTPS, certificate, redirect scheme, canonical hostname, and custom domain assignment. | DNS and TLS observations |
| G6-05 | Review firewall/WAF, bot abuse controls, proxy headers, and endpoint-level rate limiting appropriate to risk. | Provider policy and controlled tests |
| G6-06 | Establish health checks, actionable server error monitoring, alert routing, and log retention without sensitive leakage. | Dashboard, alert test, synthetic failure |
| G6-07 | Review function region and database locality, timeout and memory settings, connection limits, caching, and queued work. | Hosting config and measurements |
| G6-08 | Review spend alerts, project pausing tradeoffs, payment provider limits, AI usage limits, and potential runaway costs. Do not assume alerts are hard caps. | Billing settings and provider docs |
| G6-09 | Verify cron schedules, scheduled tasks, queues, and background workers use correct production identity and idempotency. | Job config and non-production tests |
| G6-10 | Confirm third-party integrations and vendor service status, with timeouts and failure paths. | Sandbox/runtime tests |
| G6-11 | Set up monitoring for functional health and field performance where justified. Analytics is optional when incompatible with privacy or business needs. | Dashboard and events observed |
| G6-12 | Scheduled endpoints authenticate their caller. On Vercel, every cron handler rejects requests without `Authorization: Bearer ${CRON_SECRET}` and fails closed when the secret is unset. | Handler code, negative request against preview |

## G7 | Controlled cutover and post-release response

| ID | Verification | Evidence |
| --- | --- | --- |
| G7-01 | Record the immutable candidate revision and deployed preview or staging build. Retest after changes. | Git SHA and deployment metadata |
| G7-02 | Verify critical flows against preview/staging with comparable settings. Note all differences from production. | Real HTTP and browser results |
| G7-03 | Prepare exact release route: PR merge, manual promotion, staged deployment, or CI trigger. Identify implicit auto-deploy behavior. | Settings and release runbook |
| G7-04 | Document last known good revision, application rollback procedure, database compatibility, and any irreversible external effects. | Recovery procedure and deployment history |
| G7-05 | Prepare post-release smoke tests for public and authenticated routes, key actions, external services, and production telemetry. | Named steps and owner |
| G7-06 | Define rollback triggers such as elevated 5xx, broken login, access leakage, corrupt writes, or failed payment events. | Monitored thresholds and decision owner |
| G7-07 | Obtain explicit final release authorization for named domain, SHA, environment, and action. | Approval record |
| G7-08 | Following approval and deployment, validate the actual production revision, protected routes, key flows, logs, and alerts. | Live observations with time |
| G7-09 | Record any exceptions, incident follow-ups, rollback outcome, and whether branch/domain auto-assignment needs restoration. | Final release record |
| G7-10 | Choose progressive delivery for risky releases where the host supports it, such as Vercel Rolling Releases, with agreed stages, abort signal, and abort owner. Protect clients from version skew between deployments. | Rollout config, skew protection setting, abort plan |
| G7-11 | Automated tests reach protected previews through a scoped bypass secret held in CI, never by removing deployment protection or exposing the secret. | CI configuration and protection settings, values redacted |

## Release severity examples

- P0: secret active in browser bundle, cross-tenant access, live destructive migration, untrusted AI tool executes irreversible action without approval.
- P1: required restore path absent for critical state, failed checkout, failed authentication, missing legally required consent control, private domain unexpectedly public.
- P2: suboptimal mobile image weight, a poor but functional error message, missing supplementary event instrumentation.
- P3: additional social preview variant, optional sticky CTA, minor visual refinement.

Do not use legal conclusions based only on a generic checklist. Record jurisdiction and engage appropriate professional review for ambiguous obligations.
