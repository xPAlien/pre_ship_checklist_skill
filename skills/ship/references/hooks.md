# Optional release hooks

Hooks turn the Ship decision into a local guardrail. They are opt-in, project-scoped, and never installed by an audit. They are not enforcement: anyone running the same command outside the agent bypasses them. Keep protected branches, required CI checks, and provider permissions as the enforced boundary (see `ci-policy.md`).

## Install

From the project root, after reviewing the hook scripts in this skill's `hooks/` folder, run the installer from a reviewed checkout of this repository:

```sh
node <checkout>/bin/pre-ship-checklist-skill.js install-hooks --dry-run
node <checkout>/bin/pre-ship-checklist-skill.js install-hooks --write-settings
node <checkout>/bin/pre-ship-checklist-skill.js install-hooks --git --write-settings
```

The npm registry package lags this repository. Use it only after a release containing `install-hooks` is published.

- Files go to `.claude/hooks/ship/`. Changed managed files stop the install unless `--force` is given after review.
- Without `--write-settings`, the installer prints the `.claude/settings.json` entries for you to add. With it, entries merge into existing settings without removing anything, and a second run adds nothing.
- `--git` installs a pre-push hook. An existing unmanaged pre-push hook stops the install, even with `--force`. Chain `.claude/hooks/ship/git-pre-push.sh` from it yourself.
- The hooks need Node.js 18 or newer. The Git hook also needs Python 3.10 or newer.
- The settings entries call `node "$CLAUDE_PROJECT_DIR/.claude/hooks/ship/<hook>.cjs"`. CI tests the hook scripts on Windows, macOS, and Linux, but not Claude Code launching them. On Windows, run one guarded command after installing to confirm the hook fires.

## Pre-deploy guard (Claude Code PreToolUse)

Runs before Bash and Vercel MCP tool calls.

| Action | Examples | Decision |
| --- | --- | --- |
| Release | `vercel --prod`, `vercel deploy --target=production`, `vercel promote`, `vercel rollback`, `vercel rolling-release start/approve/complete`, `vercel alias set`, `git push` to a production branch, `gh pr merge`, `npm publish`, Vercel MCP promote, rollback, alias, rolling release, production `create_deployment` | Deny unless `.ship/report.json` exists, matches HEAD, is newer than the age limit, and is not NO-GO. Otherwise ask a person to confirm. |
| Data or provider change | Prisma, Drizzle, Supabase, Knex, Sequelize, Rails, and Alembic migrations, `vercel env add/rm/update/pull`, firewall, domain, DNS, and certificate changes, Vercel MCP env, protection, firewall, project, domain, DNS, and Global Config writes | Always ask a person to confirm the target. |
| Everything else | `vercel list`, `vercel inspect`, `git push` to a feature branch, Vercel MCP reads | No output. The call proceeds normally. |

The guard recomputes the verdict floor. A report edited to say GO while P0 or P1 findings, critical unknowns, or failing critical gates remain is treated as NO-GO. A GO report never auto-approves. The guard returns `ask`, because a verdict is not deployment approval.

Settings:

- `SHIP_PRODUCTION_BRANCHES`: comma-separated production branches. Default `main,master,production`.
- `SHIP_REPORT_MAX_AGE_HOURS`: report age limit. Default `24`.
- `SHIP_REPORT_PATH`: report location relative to the project. Default `.ship/report.json`.

## Post-deploy follow-through (Claude Code PostToolUse)

Runs after a release action. It finds `*.vercel.app` URLs in the command output plus the report's target domain, sends plain GET requests without cookies, tokens, or bypass headers, and returns the G7-08 checklist to the agent.

- `SHIP_SMOKE=0`: skip network requests.
- `SHIP_SMOKE_PATHS`: paths expected to answer below 400. Default `/`.
- `SHIP_PROTECTED_PATHS`: paths expected to refuse anonymous access with 401, 403, or a redirect.

A smoke result is evidence for G7-08, not a full production verification.

## Git pre-push secret floor

Runs `preflight.py --fail-on secret` over tracked files before each push. It blocks on high-confidence credential patterns, service-role JWTs, client-exposed secret variable names, and tracked env files. It prints locations and pattern names, never values. It does not scan Git history.

- Missing Python prints a warning and allows the push. `SHIP_PREPUSH_STRICT=1` blocks instead.
- `SHIP_PREPUSH_SKIP=1` skips one push by explicit choice. Rotate any real credential regardless.

## Other agents and CI

Codex and other agents do not run Claude Code hooks. Use the Git pre-push hook locally and the CI step in `ci-policy.md` so every agent and person hits the same secret floor.

## Remove

Delete the two entries from `.claude/settings.json`, the `.claude/hooks/ship/` folder, and the managed `.git/hooks/pre-push` file. The installer never deletes files.
