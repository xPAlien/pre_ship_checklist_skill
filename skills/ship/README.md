# Ship | Production Release Gate

Version 0.6.0 | Standard distribution layout

An evidence-based release readiness workflow for websites, apps, APIs, and AI services. The default action is a read-only audit, not a deployment. Vercel-specific checks apply only to Vercel-hosted release units.

## Package

```text
ship/
  SKILL.md
  README.md
  references/
    checklist.md
    backend-controls.md
    backend-review.md
    ci-policy.md
    official-sources.md
    source-mapping.md
    vercel.md
    hooks.md
    report-artifact.md
  scripts/
    preflight.py
    report.py
  hooks/
    deploy-guard.cjs
    post-deploy.cjs
    ship-hooks-lib.cjs
    git-pre-push.sh
  templates/
    ship-report.md
    ship-report.schema.json
    ship-report.example.json
```

The three specialist audits live in sibling folders named `pre-launch-checklist`, `vibe-coder-security-checklist`, and `ai-code-review`. The main Ship workflow remains useful without them.

## Installation and updates

Use the repository's Vercel Skills CLI workflow. Existing installations need a reviewed backup and ownership handoff before the new manager writes files. See `docs/skills-cli-migration.md` at the repository root.

```sh
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --global --agent claude-code codex --skill ship pre-launch-checklist vibe-coder-security-checklist ai-code-review --copy
npx skills@1.7.2 list --global
npx skills@1.7.2 update ship pre-launch-checklist vibe-coder-security-checklist ai-code-review --global
```

The pinned manager requires Node.js 22.20.0 or newer. Git is also required. For project scope, omit `--global` during installation and use `--project` for updates. A CLI pin is not a source revision pin. Review source changes and retain backups before updates.

Do not run the compatibility npm installer over Skills CLI-owned destinations. The compatibility installer reads the same authoritative source folders and remains available for legacy workflows.

## Use

Invoke `$ship` in Codex or `/ship` in Claude Code. Request a read-only production-readiness audit of the exact repository and revision. The workflow reports evidence, critical unknowns, owner decisions, and one `GO`, `CONDITIONAL GO`, or `NO-GO` verdict.

A verdict is advisory. It does not replace protected branches, required CI checks, provider permissions, or explicit release approval.

## Optional offline preflight

From this installed skill folder:

```sh
python scripts/preflight.py --root /path/to/project
python scripts/preflight.py --root /path/to/project --fail-on secret --format text
```

Use `python3` on systems where Python 3 has no `python` alias. Python 3.10 or newer is required for the helpers, not for installation. The preflight helper provides structural hints with file paths and line numbers, never credential values. It flags common AI, payment, cloud, and source-control credentials, Supabase service-role JWTs, client-exposed secret variable names such as public-prefixed service-role keys, tracked env files, and Vercel cron handlers that skip `CRON_SECRET`. It does not prove application security or issue a release verdict.

## Report artifact

```sh
python scripts/report.py skeleton --root /path/to/project > /path/to/project/.ship/report.json
python scripts/report.py validate /path/to/project/.ship/report.json --root /path/to/project
python scripts/report.py render /path/to/project/.ship/report.json --format html > report.html
```

The JSON record follows `templates/ship-report.schema.json`. Validation enforces the release policy: open P0 or P1 findings, critical unknowns, or failing critical gates force NO-GO. It also rejects secret-like values. Rendering refuses invalid reports. The HTML page is a private record with no external requests. See `references/report-artifact.md`.

## Optional hooks

`pre-ship-checklist-skill install-hooks` installs a Claude Code deploy guard, a post-deploy smoke check, and an optional Git pre-push secret floor into one project. The deploy guard denies production releases without a fresh passing report for HEAD and asks a person to confirm everything else. See `references/hooks.md`. Hooks are local guardrails, not CI enforcement.

## Backend release review

The 25 backend source items supplement the original 40. `references/backend-controls.md` maps them to the existing gates with evidence requirements and primary sources. `references/backend-review.md` defines optional read-only reviewers, a sequential fallback, explicit approval before fixes, one writer, and separate owner actions.

No automatic account deletion, Git-history rewrite, live payment tests, credential rotation, or production-data mutation occurs through an audit. Missing budgets, grace periods, retention rules, and provider evidence remain unresolved rather than invented.

## Verification limits

Distribution tests check discovery, installation, updates, package assets, review-contract preservation, hook decisions, and report policy. They do not run your production app or launch your coding agents. Verify agent discovery on your own machine after migration.
