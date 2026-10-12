# Backend review protocol

Use this protocol with [backend-controls.md](backend-controls.md) and the main Ship workflow. It defines an audit, an approval checkpoint, and a separate fix phase. It never grants deployment authority.

## 1. Scope and execution

Identify the exact repository revision, provider accounts, target environment, and affected product features first. Discover existing limits and business policies from approved records. Ask the owner only for missing decisions such as budgets, free-credit eligibility, retention, suspension policy, paid-through dates, and grace periods. Do not guess.

The default is one read-only coordinator. With supported delegation, assign at most one reviewer to each applicable group below. Reviewers inspect in parallel, then the coordinator evaluates all eight gates in order. Without delegation, execute the same groups sequentially. Record the actual execution mode. Do not claim independent review or five subagents unless they ran.

| Review group | Controls | Existing gates | Review emphasis |
| --- | --- | --- | --- |
| Keys and access | BE-01 through BE-06 | G1, G2 | Secret exposure, runtime permissions, isolation, cookies, logs |
| Cost and abuse | BE-07 through BE-10 | G1, G3, G6 | Concurrent quotas, paid API abuse, uploads, free-credit claims |
| Payments and entitlements | BE-11 through BE-15 | G1, G2, G3 | Forgery, duplicates, recovery, trusted amounts, lifecycle state |
| Failures and recovery | BE-16 through BE-20 | G1, G2, G6 | Alert delivery, restore evidence, missing jobs, account suspension |
| Launch operations | BE-21 through BE-25 | G0, G1, G6, G7 | Data cleanup proposals, payment mode, administrator access, renewal, dependencies |

Increase verification depth for keys and payments through negative tests, concurrent cases, and an independent second review where available. Never prescribe a model name or assume a default effort setting. Select only supported effort options within the approved resource budget. Higher effort is not proof of correctness.

## 2. Read-only boundaries

Give reviewers the smallest read-only tool set available. Shells, scripts, and MCP/provider tools need explicit restriction too. Disabling an editor alone does not enforce read-only access. Without enforceable isolation, use the coordinator sequentially with approved safe reads rather than unrestricted parallel agents.

Do not modify repository files, Git refs, dashboards, credentials, payment mode, access rules, billing settings, or production data during review. Only explicitly permitted report paths and disposable test artifacts are writable. Inspect scripts before execution. Route tests with side effects to isolated synthetic fixtures. Do not run package lifecycle scripts or remote installers without review.

Do not rewrite Git history. Do not rotate or revoke credentials, turn on MFA, ban users, pause projects, delete test accounts, or change live configuration as an audit shortcut. Those are separate owner actions. These restrictions override conflicting remediation suggestions in supplementary checklists.

Keep passwords, tokens, private keys, signing secrets, recovery codes, full signed URLs, and customer records out of prompts, reports, screenshots, logs, and public PRs. Inspect secret metadata and sanitized evidence instead. Never request a secret value from the user. Send secret-exposure findings through an approved private location with access appropriate to the incident.

Payment tests use verified sandbox or test-mode credentials and synthetic objects only. Stop when mode or account identity is unknown. Real charges, refunds, subscription changes, emails, and SMS are outside audit authority. Database restores use an approved disposable non-production target and approved data. Do not export production customer data for a drill.

## 3. Findings and approval

Each reviewer returns control IDs, status, severity, evidence location, revision/environment, timestamp, impact, proposed correction, regression test, and remaining owner decision. Missing access produces NEEDS VERIFICATION rather than PASS or an unsupported claim of absence.

The coordinator deduplicates findings by root cause and resource boundary, preserving all contributing control IDs. Maintain coverage for every BE control even when several share one finding. Different tenants, environments, or failure modes still need separate evidence. Group assignment never weakens the central release policy.

Show the complete findings and proposed edits before making fixes. Stop for explicit approval of the named scope. An audit invocation or screenshot checklist is not fix authorization. A critical policy decision, provider setting, or verification gap blocks GO until resolved. Accepted noncritical exceptions require an owner, reason, and due date.

## 4. Approved fixes

Use one designated writer for each approved change set. Reviewers do not edit. The writer records the baseline, makes minimal corrections, adds regression tests, and re-runs affected checks. No two agents write the same file. Process dependent changes in order instead of promising one automatic fix pass.

Keep dashboard and production work in a separate owner-action table. Record provider/account/environment, setting, current evidence, requested value or decision, approval, operator steps, rollback or containment, and verification. Give current documented steps when available. Do not invent dashboard controls.

Account cleanup requires an exact-ID manifest, fixture provenance, retention review, restore or recovery consideration, and separate approval. Keep suspected records unchanged until verified. Prefer explicit fixture tags over name matching. A cleanup proposal never authorizes deletion.

Recheck the resulting revision after each approved change set. Do not reuse old PASS evidence for changed controls. Report files changed, tests executed, tests not run, remaining findings, owner actions, and production changes performed. A successful skill test suite is not proof of an audited application's runtime security.

## 5. Completion

Use [the Ship report](../templates/ship-report.md) for the single release decision. Include the backend coverage ledger and owner-action table. GO, CONDITIONAL GO, and NO-GO retain their existing meanings. Separate merge, publish, install, and deployment approval remains required.

This package supplies review instructions. It does not create five persistent agents or enforce a tool sandbox. Configure tool permissions in the active harness and verify the available restrictions. For Claude Code, consult [subagent documentation](https://code.claude.com/docs/en/sub-agents). Do not infer equivalent settings for another harness.
