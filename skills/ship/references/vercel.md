# Vercel Release Playbook

Use this file only when the project is hosted on Vercel or the user explicitly requests a Vercel migration. Check current Vercel documentation before relying on plan-specific behavior.

## V1 | Provider identity and release path

- Inspect the linked Vercel project, team, root directory, framework preset, production branch, assigned production domains, and deployment status.
- Confirm whether merging to the tracked branch auto-deploys to production. A merge might constitute a production release.
- Check whether production domains auto-assign to new builds, or whether deployment staging and manual promotion are in use.
- Correlate Git SHA, deployment ID, build status, and target domain. A healthy prior deployment does not validate a new commit.
- Avoid changing environment or branch settings during audit.

## V2 | Non-public access and environment boundaries

- Inspect Vercel Authentication scope and test from a logged-out session. Standard Protection does not protect normal production domains. Use an explicit all-deployments configuration when production itself must remain private.
- Inspect access grants, shareable links, exceptions, and automation bypass access. Never place bypass tokens in public code or untrusted output.
- Verify distinct Production, Preview, and Development variable scopes. Redact values in reports.
- Preview builds must not send production mail, charge real accounts, mutate production databases, or invoke irreversible jobs without a documented and authorized isolation design.
- Do not use `robots.txt` to protect non-public deployments. Authentication and access control are separate from search indexing.

## V3 | Functions, data, and network

- Confirm TLS and canonical domain ownership. Check 301/308 redirects and prevent redirect loops.
- Review Node/runtime and framework versions, package lockfile, functions, execution time, region, and distance from database.
- Check cache policy for authenticated and user-specific responses. Prevent tenant content from entering public caches.
- Review WAF and bot protections as defense in depth. Keep business-level authorization and rate limits in the application.
- Inspect logging, observability, error alerts, and privacy-conscious event collection.
- Verify all production dependency services: database, storage, payment processor, email, queue, scheduled jobs, AI providers.

## V4 | Performance and cost

- Where appropriate, enable or verify Speed Insights for real-user metrics. Treat initial Lighthouse results as lab evidence.
- Review image, script, font, and cache optimization based on observed bottlenecks.
- Inspect actual Spend Management and alert behavior. Alerts do not guarantee a global stop. Pause settings have availability consequences. Verify provider plan and billing policies.
- For AI workflows, apply vendor-side quotas and safe per-user and per-request budgets in addition to Vercel monitoring. A vendor budget setting is not proof of bounded application consumption.

## V5 | Safe production path

1. Verify the PR candidate and immutable Git SHA.
2. Verify checks and test a protected preview against its actual URL.
3. Identify deployment mode. When promoting a Preview deployment, Vercel builds a production deployment with production environment variables. Retest production-specific assumptions.
4. For a staged Production deployment with auto-assign disabled, promotion uses the existing production build without rebuilding. Validate the specific staged deployment first.
5. Confirm rollback candidate, operator access, database compatibility, and live side effects.
6. Present GO/NO-GO report to authorized approver.
7. Obtain separate explicit authorization for the exact production action and audience protection change.
8. Deploy or promote only after approval. Verify domain and runtime checks immediately afterward.
9. Observe alerting and errors for the agreed period. Roll back only with incident authority, then verify service recovery.

## V6 | CLI reference

Use only after verifying the installed CLI version and project link. These commands are illustrative. Replace placeholders with verified IDs.

```bash
vercel list --status READY
vercel inspect <deployment-url>
vercel logs --deployment <deployment-id> --level error --limit 50
vercel curl / --deployment <deployment-url>
vercel promote status
vercel rollback status
```

Potential production operations, not read-only audit commands:

```bash
vercel promote <verified-deployment-url>
vercel rollback
```

Do not run either production operation without separate explicit authorization. Promotion from Preview and promotion of staged Production use distinct build behaviors. Do not assume source or environment equivalence.

## V7 | Important rollback limitations

- Instant rollback changes production routing to an earlier eligible deployment. It does not undo database schema changes, data writes, external emails, payment actions, or credential changes.
- Previous deployment environment variables and jobs might be stale. Verify compatibility during recovery planning.
- Rollback behavior and eligible target history differ by plan. Verify current account capabilities before claiming a specific target exists.
- Rollback might change auto-assignment of production domains. Confirm the intended release workflow after recovery.

Primary documentation is linked in `official-sources.md`.
