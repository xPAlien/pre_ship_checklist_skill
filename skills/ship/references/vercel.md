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
- For automated tests against protected previews, use Protection Bypass for Automation. Tests send the `x-vercel-protection-bypass` header with the `VERCEL_AUTOMATION_BYPASS_SECRET` value from CI secrets. Never remove protection for testing, never print the secret, and never put it in a query string that reaches logs or reports.
- Prefer the sensitive environment variable type for Preview and Production secrets so values stay unreadable after creation. Confirm with the provider record, not source code.

## V3 | Functions, data, and network

- Confirm TLS and canonical domain ownership. Check 301/308 redirects and prevent redirect loops.
- Review Node/runtime and framework versions, package lockfile, functions, execution time, region, and distance from database.
- Check cache policy for authenticated and user-specific responses. Prevent tenant content from entering public caches.
- Review WAF and bot protections as defense in depth. Vercel Firewall custom rules support `rate_limit`, `challenge`, and `deny` actions for paths such as `/api` and auth routes. Keep business-level authorization and per-user quotas in the application.
- Vercel cron jobs call public URLs. Each cron handler must reject requests whose `Authorization` header differs from `Bearer ${CRON_SECRET}`, and must fail closed when `CRON_SECRET` is unset. The preflight helper flags cron paths from `vercel.json` whose handler never references `CRON_SECRET`.
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

## V6 | Progressive delivery and version skew

- Rolling Releases (Pro and Enterprise) send a configured share of production traffic to the new deployment in stages. Prefer them for risky releases. Agree the stages, the error signal, and the abort owner before release. `vercel rolling-release abort --dpl <url>` is the fast rollback during a rollout.
- Rolling Releases change production traffic. Configuring, starting, approving, or completing one needs the same explicit authorization as a promotion.
- Skew Protection keeps clients on the deployment version they loaded, so old tabs do not call new server actions or assets. Enabling Rolling Releases through the API also enables it. Verify the project setting for Next.js apps with server actions or long-lived sessions.
- Database changes still need expand and contract migrations. Both versions serve traffic during a rollout.

## V7 | CLI reference

Use only after verifying the installed CLI version and project link. These commands are illustrative. Replace placeholders with verified IDs.

```bash
vercel list --status READY
vercel inspect <deployment-url>
vercel logs --deployment <deployment-id> --level error --limit 50
vercel curl / --deployment <deployment-url>
vercel promote status
vercel rollback status
vercel rolling-release fetch
vercel logs --environment production --level error --since 5m
```

Potential production operations, not read-only audit commands:

```bash
vercel promote <verified-deployment-url>
vercel rollback
vercel rolling-release start --dpl <verified-deployment-url>
vercel rolling-release approve --dpl <verified-deployment-url> --currentStageIndex 0
vercel rolling-release complete --dpl <verified-deployment-url>
```

Do not run any of these production operations without separate explicit authorization. Promotion from Preview and promotion of staged Production use distinct build behaviors. Do not assume source or environment equivalence.

## V8 | Important rollback limitations

- Instant rollback changes production routing to an earlier eligible deployment. It does not undo database schema changes, data writes, external emails, payment actions, or credential changes.
- Previous deployment environment variables and jobs might be stale. Verify compatibility during recovery planning.
- Rollback behavior and eligible target history differ by plan. Verify current account capabilities before claiming a specific target exists.
- Rollback might change auto-assignment of production domains. Confirm the intended release workflow after recovery.

## V9 | Vercel MCP evidence

When the Vercel MCP server is connected, use it to replace `NEEDS VERIFICATION` with provider evidence. Reuse known team and project IDs. Report identifiers, settings, and statuses, never secret values.

Allowed in `audit` mode (read-only):

| Evidence | Tools |
| --- | --- |
| Project, production branch, framework, protection | `get_project`, `list_project_domains`, `get_project_domain`, `list_aliases`, `list_promote_aliases` |
| Candidate and history | `list_deployments`, `get_deployment`, `list_deployment_events`, `get_git_deployment_context`, `list_deployment_aliases` |
| Environment scoping | `filter_project_envs` for names, targets, and types. Do not request decrypted values. |
| Firewall and abuse | `get_firewall_config`, `get_active_attack_status`, `get_bypass_ip` |
| Runtime health | `get_runtime_errors`, then `get_runtime_logs` for a narrow window |
| Progressive delivery | `get_rolling_release_config`, `get_rolling_release` |
| DNS and certificates | `get_domain`, `get_domain_config`, `get_records`, `list_certs` |
| Docs | `search_vercel_documentation` for current behavior |

Forbidden without separate explicit authorization: `create_deployment`, `request_promote`, `request_rollback`, `start_rolling_release`, `approve_rolling_release_stage`, `complete_rolling_release`, `update_rolling_release_config`, `assign_alias`, `create_project_env`, `edit_project_env`, `update_project`, `update_project_protection_bypass`, `patch_url_protection_bypass`, `update_firewall_config`, `put_firewall_config`, `update_attack_challenge_mode`, `pause_project`, `unpause_project`, domain, DNS, certificate, Global Config, and billing writes. The optional deploy guard in `hooks.md` asks for confirmation on these calls.

A `requires_user_action` result means a person finishes the step in the dashboard. Record the URL and leave the item pending.

Primary documentation is linked in `official-sources.md`.
