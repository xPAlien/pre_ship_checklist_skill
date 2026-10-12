# Original 40 Items | Vetting and Mapping

The first 20 are from the typed user checklist. The second 20 are from the two attached screenshots. No item is silently discarded. `Universal` means a required control for applicable application behavior, not a demand for a marketing page on an API.

## Typed website and UX list

| # | Original item | Gate | Decision |
| --- | --- | --- | --- |
| 1 | Custom 404 page | G3 | Browser UI recommended. Correct 404 response mandatory for unknown routes. APIs return structured errors. |
| 2 | Meta title on every page | G5 | Required for indexable pages. Private and utility routes use context-appropriate metadata. |
| 3 | Meta description on every page | G5 | Prioritize distinct descriptions on meaningful public pages. Not a release blocker on all private routes. |
| 4 | CTA above the fold | G4 | Conversion-oriented pages only. |
| 5 | Favicon set | G5 | Public-facing web product branding. |
| 6 | robots.txt file | G5 | Public SEO sites. Never rely on it to hide private content. |
| 7 | sitemap.xml | G5 | Public canonical indexable URLs only. |
| 8 | Open Graph image | G5 | Public link-sharing pages. Test actual share metadata. |
| 9 | Alt text on every image | G3 | Meaningful alt on informative images. Empty alt for decoration. |
| 10 | Mobile breakpoints | G4 | Responsive app UI. Test actual rendered widths and behavior. |
| 11 | Sticky mobile CTA | G4 | Optional marketing enhancement. Must not obstruct content. |
| 12 | Loading states | G3 | User-facing asynchronous operations. |
| 13 | Form error states | G3 | Every user-input form. Validate on server too. |
| 14 | Thank you page | G3 | Confirmation state needed for conversion or submission flows. Dedicated page optional. |
| 15 | Privacy policy page | G5 | Based on data practices, laws, and audience. Verify factual accuracy. |
| 16 | Terms and conditions | G5 | Based on service type and legal exposure. Obtain legal review for material terms. |
| 17 | Cookie banner | G5 | Only when consent is required. Test controls and tracker blocking. |
| 18 | Analytics installed | G5/G6 | Optional service. Require measurement appropriate to goals and privacy. |
| 19 | Real contact address | G3/G5 | Working contact channel. Physical mailing address only when needed. |
| 20 | Compressed images | G4 | Optimize production asset delivery based on real media. |

## Screenshot security and release list

| # | Original item | Gate | Decision |
| --- | --- | --- | --- |
| 1 | Hide every API key, nothing in frontend or Git | G1 | Protect private secrets. Publishable keys are intentionally public by design. |
| 2 | Rotate any key ever committed | G1 | Investigate history. Rotate compromised private keys through approved process. |
| 3 | Rate limiting to prevent runaway bills | G1/G6 | Apply per-user and per-endpoint quotas based on abuse risk. |
| 4 | Auth on every route, not only UI | G1 | Authenticate protected routes. Public endpoints remain intentionally public. |
| 5 | Database rules restrict users to their data | G1/G2 | Verify tenant/object authorization and database policy where relevant. |
| 6 | Validate inputs on server | G1 | Required for untrusted inputs. |
| 7 | Spending cap on AI provider | G6 | AI-using projects only. Verify actual provider budget behavior. |
| 8 | Errors do not leak stack traces | G1/G3 | Mandatory production error privacy. |
| 9 | Error tracking | G6 | Required level depends on availability and risk. Validate alert delivery. |
| 10 | Back up database and test restore | G2 | Critical for important persisted data. Restoration in isolated environment. |
| 11 | Custom 404 and 500 pages | G3 | Browser apps. Correct statuses and safe fallback required. |
| 12 | Work on low-cost Android phone | G4 | Mobile audience. Include constrained conditions. |
| 13 | Fix anything taking more than 3 seconds | G4 | Replace blanket stopwatch rule with measured Core Web Vitals and user-critical latency budgets. |
| 14 | Meta tags plus OG image | G5 | Public share and search pages. |
| 15 | Privacy policy and terms | G5 | Verify actual applicability and published accuracy. |
| 16 | Analytics to find drop-off | G5/G6 | Useful when lawful, necessary, and consent-aware. |
| 17 | Test signup, payment, password reset end-to-end | G3 | Test flows present in the product. Include failure paths. |
| 18 | Emails do not land in spam | G3/G6 | Test sender authentication and delivery. Inbox placement never guaranteed. |
| 19 | Contact path | G3 | Working support path if product has users. |
| 20 | Write a rollback plan | G2/G7 | Mandatory for stateful services. Routing rollback alone is insufficient. |

## Additional controls added by the Ship Skill

- Dependency and source supply chain, release identity, CI and Git approval, and change scope.
- CSRF, CORS, SSRF, unsafe redirects, uploads, security headers, and session hardening.
- Cross-tenant and role-level authorization tests.
- Safe migrations, data retention, retries and idempotency, durable backups, and staged restores.
- Accessible keyboard, focus, contrast, screen reader, and reduced-motion behavior.
- CDN cache isolation, hosting cost and runtime limits, regions, observability, alerts, DNS and TLS.
- Preview access protection, explicit cutover authority, production smoke tests, incident triggers, and post-rollback workflow restoration.
- AI-agent prompt injection, tool permissions, output validation, and data exfiltration risk where relevant.
