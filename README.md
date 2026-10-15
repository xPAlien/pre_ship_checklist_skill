# Pre-Ship Checklist Skill

v0.5.0 | Standard Agent Skills layout

One evidence-based release workflow with two independent specialist audits. It issues a GO, CONDITIONAL GO, or NO-GO decision from evidence, records it as a validated report, and can guard production deploys with optional hooks. Vercel Skills CLI is the preferred installation and update manager. No automatic deployment or production changes.

## What's new in 0.5.0

- Report artifact: `.ship/report.json` with a JSON schema. `report.py` validates it against the release policy, rejects secret-like content, and renders Markdown or a private HTML page.
- Optional hooks: a Claude Code deploy guard that blocks production releases without a fresh passing report, a post-deploy smoke check, and a Git pre-push secret floor.
- Stronger secret scan: AI provider, payment, cloud, and source-control credentials, Supabase service-role JWTs, client-exposed secret variable names, and unauthenticated Vercel cron handlers. Locations only, never values.
- Vercel controls: Rolling Releases, Skew Protection, `CRON_SECRET`, Protection Bypass for Automation, sensitive environment variables, Firewall rate limits, and a read-only Vercel MCP evidence list.
- Faster audits: specialists defer release decisions to `ship` and batch their questions. Backend controls load only when the project has a backend. Specialist items have stable `PL-NN` and `SEC-NN` IDs.
- Fixes: correct fast-mode counts, rotate-first secret guidance instead of history rewrites, risk-based warning deadlines, and accurate Vercel migration advice.

## Skills

| Skill | Purpose | Invocation |
| --- | --- | --- |
| ship | Eight release gates, one consolidated report, optional JSON and HTML report artifact, optional deploy hooks | `$ship` in Codex or `/ship` in Claude Code |
| pre-launch-checklist | 25 infrastructure and operations checks | `/pre-launch-checklist` in Claude Code |
| vibe-coder-security-checklist | 36 application security checks | `/vibe-coder-security-checklist` in Claude Code |

The original 40 source items and 25 backend additions remain intact. These are 65 source items with overlapping controls, not 65 independent security tests. The main workflow covers keys, cost abuse, payments, recovery, and launch operations. It supports optional read-only reviewers, requires scoped approval before fixes, and uses one writer.

## Install with Vercel Skills CLI

Existing users: complete [the migration guide](docs/skills-cli-migration.md) before running installation. Installation and updates overwrite selected managed content. Preserve local edits first.

Prerequisites: Git and Node.js 22.20.0 or newer, with npm. This repository pins Skills CLI 1.7.2 for its documented commands and integration tests. Node 24 is used in CI. Python 3.10 or newer is optional. It runs the Ship preflight and report helpers and the Git pre-push hook, not installation.

The same commands work in Windows PowerShell and macOS/Linux terminals. On Windows, use `npx.cmd` instead of `npx` when PowerShell blocks the npm PowerShell shim. Do not weaken the execution policy.

```sh
# Discover the three skills without installing
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --list

# Install only this collection for Claude Code and Codex, globally
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --global --agent claude-code codex --skill ship pre-launch-checklist vibe-coder-security-checklist --copy

# Inspect installed skills
npx skills@1.7.2 list --global

# Update only this collection, not unrelated skills
npx skills@1.7.2 update ship pre-launch-checklist vibe-coder-security-checklist --global
```

These repository-wide commands target the default branch. For a pending PR, test its checkout or an explicitly reviewed branch source. Do not expect unmerged changes from the default branch.

`--copy` avoids requiring symlink support. The CLI still owns the installed copies and update records. Omit `--copy` to use the upstream symlink workflow after testing it on your machine. Do not use two managers for the same skill destination.

For one project, run the installation command from its root without `--global`. Use `--project` on subsequent named updates. Commit the resulting `skills-lock.json` and the intended project installation files according to your project policy. A CLI version pin does not pin the skill repository revision. Review source changes before updates. See the migration guide for revision pinning and rollback.

## Source layout

```text
skills/
  ship/
    SKILL.md
    references/   gate criteria, Vercel playbook, hooks, report contract
    scripts/      preflight.py (offline hints, secret floor), report.py (validate, render)
    hooks/        deploy guard, post-deploy check, Git pre-push hook
    templates/    Markdown report, JSON schema, worked example
  pre-launch-checklist/
    SKILL.md
  vibe-coder-security-checklist/
    SKILL.md
```

Each skill has one authoritative source. Regression tests live in `test/`, outside the installed skill folders. No duplicate root `.skill` files or root `ship/` folder remain.

Source mappings: [original 40 items](skills/ship/references/source-mapping.md), [25 backend items](skills/ship/references/backend-controls.md), [review protocol](skills/ship/references/backend-review.md).

## Compatibility installer

The existing npm installer remains supported for established workflows. It now reads the same `skills/` folders. It does not invoke Skills CLI, install Node, or manage Skills CLI updates. Its legacy agent identifiers and Goose hints behavior remain unchanged.

From a reviewed checkout:

```sh
node bin/pre-ship-checklist-skill.js install --agent codex --dry-run
node bin/pre-ship-checklist-skill.js doctor --agent codex
```

It refuses symlink-managed destinations and recognized Skills CLI ownership records even with `--force`. Custom targets require explicit ownership review. For normal unmanaged destinations, differing files still stop installation before writes. Unrelated files remain untouched.

No npm publication is required for Skills CLI to install from this repository. Publishing the npm package remains a separate approval. The registry package lags this repository, so use a reviewed checkout for `install-hooks` until a release containing it is published.

## Optional hooks and report artifact

From a project root, with a reviewed checkout of this repository:

```sh
node <checkout>/bin/pre-ship-checklist-skill.js install-hooks --dry-run
node <checkout>/bin/pre-ship-checklist-skill.js install-hooks --git --write-settings
```

- Deploy guard (Claude Code PreToolUse): denies `vercel --prod`, promote, rollback, rolling-release advances, production `git push`, `gh pr merge`, and package publishing unless `.ship/report.json` matches HEAD, is fresh, and is not NO-GO. A passing report still asks a person to confirm. Migrations and provider configuration changes always ask.
- Post-deploy follow-through (PostToolUse): read-only smoke checks against the new deployment URL and the G7-08 checklist.
- Git pre-push secret floor: blocks pushes with credential patterns, service-role JWTs, client-exposed secret variable names, or tracked env files.

The report artifact is `.ship/report.json`, validated against the release policy and rendered to Markdown or a private HTML page. Details: [hooks](skills/ship/references/hooks.md), [report artifact](skills/ship/references/report-artifact.md). Hooks are local guardrails. Protected branches and required CI checks remain the enforced boundary.

## Run the audit

Invoke `$ship` in Codex or `/ship` in Claude Code and request a read-only production-readiness review. The report uses `PASS`, `FAIL`, `NEEDS VERIFICATION`, and `NOT APPLICABLE`, with `GO`, `CONDITIONAL GO`, or `NO-GO`. A passing report does not authorize a merge, deployment, credential rotation, or production-data change.

A typical flow:

1. `/ship` audits the repository and any connected provider evidence, then reports findings by severity.
2. With your consent, it saves `.ship/report.json`, validates it, and renders a private HTML view.
3. You fix blockers and re-run the audit until the verdict fits your release policy.
4. With hooks installed, a production deploy command checks the report for the current commit and still asks you to approve.

Run the offline helpers directly:

```sh
python skills/ship/scripts/preflight.py --root /path/to/project --format text
python skills/ship/scripts/preflight.py --root /path/to/project --fail-on secret
python skills/ship/scripts/report.py validate /path/to/project/.ship/report.json --root /path/to/project
python skills/ship/scripts/report.py render /path/to/project/.ship/report.json --format html > report.html
```

## Maintainer verification

```sh
npm test
npm run test:ship
npm run verify:package
python skills/ship/scripts/preflight.py --root . --fail-on secret --format text
```

CI runs these checks on Windows, macOS, and Linux, plus a Python 3.10 job for the helpers. Actions are pinned to commit SHAs. A separate step installs the pinned upstream Skills CLI into a temporary tooling directory and runs `npm run test:skills-cli`. The integration script isolates HOME, user profile, agent directories, Git configuration, and update fixtures. It verifies discovery, supporting files, both installation scopes, and targeted updates through the real CLI.

The integration tests validate distribution behavior. They do not launch Codex or Claude Code, audit a production application, publish a package, or modify your installed copies.

See [maintainer guidance](CLAUDE.md) and [contribution guidance](CONTRIBUTING.md).

## Primary documentation

- [Vercel Skills CLI](https://github.com/vercel-labs/skills)
- [CLI documentation](https://skills.sh/docs/cli)
- [Agent Skills specification](https://agentskills.io/specification)

## License

MIT. See [LICENSE](LICENSE).
