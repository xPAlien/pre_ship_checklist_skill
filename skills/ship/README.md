# Ship | Production Release Gate

Version 0.4.0 | Standard distribution layout

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
  scripts/
    preflight.py
  templates/
    ship-report.md
  tests/
    test_preflight.py
```

The two specialist audits live in sibling folders named `pre-launch-checklist` and `vibe-coder-security-checklist`. The main Ship workflow remains useful without them.

## Installation and updates

Use the repository's Vercel Skills CLI workflow. Existing installations need a reviewed backup and ownership handoff before the new manager writes files. See `docs/skills-cli-migration.md` at the repository root.

```sh
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --global --agent claude-code codex --skill ship pre-launch-checklist vibe-coder-security-checklist --copy
npx skills@1.7.2 list --global
npx skills@1.7.2 update ship pre-launch-checklist vibe-coder-security-checklist --global
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
python -m unittest discover -s tests -v
```

Use `python3` on systems where Python 3 has no `python` alias. The preflight helper provides structural hints. It does not prove application security or issue a release verdict. Python is not required to install the skill.

## Backend release review

The 25 backend source items supplement the original 40. `references/backend-controls.md` maps them to the existing gates with evidence requirements and primary sources. `references/backend-review.md` defines optional read-only reviewers, a sequential fallback, explicit approval before fixes, one writer, and separate owner actions.

No automatic account deletion, Git-history rewrite, live payment tests, credential rotation, or production-data mutation occurs through an audit. Missing budgets, grace periods, retention rules, and provider evidence remain unresolved rather than invented.

## Verification limits

Distribution tests check discovery, installation, updates, package assets, and review-contract preservation. They do not run your production app or launch your coding agents. Verify agent discovery on your own machine after migration.
