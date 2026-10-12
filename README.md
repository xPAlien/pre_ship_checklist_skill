# Pre-Ship Checklist Skill

One production release workflow with two independent specialist audits. Built for Codex, Claude Code, and compatible AgentSkills agents. The `ship` skill provides an evidence-based release gate, not an automatic deployment.

## Skills

| Skill | Scope | Command |
| --- | --- | --- |
| `ship` | Eight release gates spanning security, data, functional QA, accessibility, performance, SEO/privacy, hosting, and cutover | `$ship` in Codex or `/ship` in Claude Code |
| `pre-launch-checklist` | 25 infrastructure and operations checks for applicable systems | `/pre-launch-checklist` in Claude Code |
| `vibe-coder-security-checklist` | 36 authentication, API, database, and infrastructure security checks | `/vibe-coder-security-checklist` in Claude Code |

`ship` is the recommended entry point. It optionally draws on the specialist checklists, deduplicates overlapping risks, and issues one report. Each specialist also works by itself. The 40 checklist items from the original Ship brief appear in `ship/references/source-mapping.md`. The 25 additional backend items appear in `ship/references/backend-controls.md`. These are 65 source items with overlapping controls, not 65 independent security checks.

## v0.4.0 | Backend release review

The update adds evidence requirements for secrets and access, cost abuse, payments and entitlements, recovery, and launch operations. Five optional read-only review groups feed one report. Without supported delegation, the same review runs sequentially. Findings precede approval. One writer applies approved fixes.

Budgets and business policies need owner decisions. Dashboard work remains separate. No automatic account deletion, Git-history rewrite, live payment tests, or production changes. This update is a skill package, not an audit of your applications.

## Installation

The default installer installs all three skills globally into Claude Code folders using the documented `SKILL.md` convention.

```sh
npx pre-ship-checklist-skill install
```

For Codex:

```sh
npx pre-ship-checklist-skill install --agent codex
```

For both:

```sh
npx pre-ship-checklist-skill install --agent claude
npx pre-ship-checklist-skill install --agent codex
```

For a single project, add `--scope project`. Use `--only ship` to install only the main release skill. Use `--target <path>` for a custom skills directory and `--dry-run` to see the file plan.

```sh
npx pre-ship-checklist-skill install --agent codex --scope project --dry-run
npx pre-ship-checklist-skill doctor --agent codex
npx pre-ship-checklist-skill list
npx pre-ship-checklist-skill targets
```

### Supported targets

| Agent | Global destination | Project destination |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| Codex | `~/.agents/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| OpenClaw | `~/.openclaw/skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` |
| Hermes | `~/.hermes/skills/<name>/SKILL.md` | `.hermes/skills/<name>/SKILL.md` |
| Pi | `~/.pi/agent/skills/<name>/SKILL.md` | `.pi/skills/<name>/SKILL.md` |
| AgentSkills | `~/.agents/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| Goose | managed `.goosehints` block | managed `.goosehints` block |

The `ship` folder retains its `references/`, `scripts/`, `templates/`, and `tests/` subfolders on installation. Goose installs only a summary because Goose follows a different hints convention.

### Safe upgrade from v0.2.x

The v0.2.x Claude installer placed two flat `.skill` files in `~/.claude/skills`. The new installer writes folder-based `SKILL.md` packages. It does not delete or overwrite old flat files. After validating v0.4.0 with `doctor`, inspect and remove obsolete flat copies manually if they are still active. If a managed file differs, installation stops before any file is written. `--force` overwrites managed files only after you review the conflicts.

To pin a project version, add the package as a development dependency and run its installer from npm scripts. Direct GitHub installation also works:

```sh
npm install --save-dev pre-ship-checklist-skill@0.4.0
npx pre-ship-checklist-skill install --agent codex --scope project
```

A public npm release for v0.4.0 is a separate publishing step. Until publication is verified, use the approved GitHub revision or a local checkout. Do not assume npm serves v0.4.0.

## Run the release audit

```text
$ship Audit this repository for production. Do a read-only review first, identify the exact release revision, evaluate all applicable gates, collect evidence and return a GO, CONDITIONAL GO, or NO-GO result. Do not merge, deploy, rotate credentials, change production data, or alter deployment protection.
```

In Claude Code, use `/ship` in place of `$ship`.

The skill returns `PASS`, `FAIL`, `NEEDS VERIFICATION`, or `NOT APPLICABLE` on applicable controls and prioritizes P0 through P3 findings. Unverified critical controls block a release. A GO verdict does not authorize production changes.

The offline scanner is a hint generator, not a comprehensive security test:

```sh
python ship/scripts/preflight.py --root /path/to/project
python -m unittest discover -s ship/tests -v
```

## Maintainer checks

```sh
npm test
npm run test:ship
npm run pack:dry-run
node bin/pre-ship-checklist-skill.js install --agent codex --dry-run
```

The CI workflow runs Node tests, the Python preflight tests, and an npm package dry run. The installer preserves non-managed files and does not perform deployments.

## Maintenance and limits

- The older 25-point and 36-point audits remain independent and keep their original names and scopes. Their applicability and default severities must be evaluated against the inspected project.
- The new Ship checklist is the authority for one consolidated release verdict, avoiding duplicate findings.
- No agent report substitutes for branch protection, required CI checks, provider deployment permissions, or a named release approver.
- Production deployment, migration, secret rotation, domain promotion, and disabling access protections each require explicit authorization.

See [ship/README.md](ship/README.md) for the complete Ship package, [CLAUDE.md](CLAUDE.md) for maintainer conventions, and [CONTRIBUTING.md](CONTRIBUTING.md) for PR guidance.

## License

MIT.
