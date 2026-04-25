# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Two Claude Code skills for production readiness audits. Run them before shipping any web application.

## Skills

| File | Items | Focus |
|------|-------|-------|
| `pre-launch-checklist.skill` | 25 | Ops and infrastructure: load, database, async, resilience, observability, operations |
| `vibe-coder-security-checklist.skill` | 36 | Security: auth, API, database hardening, infrastructure, code hygiene |

The two skills are intentionally separate. The pre-launch checklist covers infrastructure failure modes; the security checklist covers application-layer vulnerabilities. They have overlapping items (rate limiting, secrets, backups) scoped differently — do not merge them.

## Skill File Format

```
---
name: skill-name
description: "trigger phrases and activation conditions"
---

# Title

## How to Use This Skill
## The N Items
## Output Format
```

The `description` field drives auto-activation. It must include all trigger phrases listed in `README.md`.

## Severity

Severity is embedded inline on each item as `[BLOCKER]` or `[WARNING]`. Do not maintain a separate numbered list — those go stale when items are added or reordered.

- **BLOCKER** — must be resolved before launch/delivery
- **WARNING** — fix within 30 days

## Editing Rules

- Both `.skill` files are plain text. Edit directly.
- Any item change must be reflected in the skill file and the summary table in `README.md`.
- The output format in each skill must always include four buckets: BLOCKERS / WARNINGS / NOT APPLICABLE / PASSED.
- `SKILL.md` has been removed. There is no zip distribution format in this repo.
