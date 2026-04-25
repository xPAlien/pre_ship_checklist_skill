# Contributing

## Adding or changing checklist items

**Proposing a new item**

Open an issue with:
- The item name and category
- The specific risk (what breaks, how an attacker exploits it)
- A concrete fix (not a generic recommendation)
- Whether it should be a BLOCKER or WARNING, and why

The bar for a new item: it must be a real failure mode that ships regularly in production apps built without security expertise. Generic best practices that require deliberate neglect don't qualify.

**Blocker vs Warning**

- **Blocker** — the app should not ship with this unresolved. Exploitable by a non-expert attacker, or causes data loss or downtime on first real traffic.
- **Warning** — serious but not immediately catastrophic. A motivated attacker could exploit it, or it will cause problems at scale. Fix within 30 days.

When in doubt, propose as Warning. Blockers are reserved for items where shipping without the fix is indefensible.

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Edit the relevant `.skill` file
3. Update `README.md` to reflect the change (item tables, severity column)
4. Keep one concern per PR — don't bundle new items with rewording existing ones

## Skill file format

```
---
name: skill-name
description: "trigger phrases and activation conditions"
---

# Title

## How to Use This Skill
[stack intake, mode selection, progress instructions]

## The N Items

### Category

N. **[BLOCKER|WARNING] Item name**
   - Risk: [what goes wrong and how]
   - Fix: [specific remediation, not generic advice]

## Output Format
[report structure]
```

Severity must be embedded inline on each item as `[BLOCKER]` or `[WARNING]`. Do not maintain a separate numbered list of blocker item numbers — those lists go stale when items are added or reordered.
