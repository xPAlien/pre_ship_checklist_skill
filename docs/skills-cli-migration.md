# Switch installation ownership to Vercel Skills CLI

## 1. Scope

This guide switches the three original Pre-Ship skills from manually copied or npm-installer copies to Skills CLI management. The fourth skill, `ai-code-review`, has no legacy installer copies. Add it with Skills CLI after migration, as section 3 shows. If you copied it by hand from the former `AI_code_review_skill` repository, back up and move that copy out of discovery paths first, like the other legacy folders. It does not update npm globally, remove other skills, install a coding agent, or change production resources.

Do not run this migration automatically from a build, package lifecycle hook, or agent audit. Pause coding-agent sessions before moving active skill folders. Work without administrator privileges.

The repository layout migration is separate from migration on your machine. A merge alone does not update installed copies.

## 2. Inventory and backup before installation

Inspect these exact locations for `ship`, `pre-launch-checklist`, and `vibe-coder-security-checklist` only:

| Scope | Claude Code | Codex |
| --- | --- | --- |
| Global | `~/.claude/skills/<name>` | `~/.agents/skills/<name>` |
| Project | `<project>/.claude/skills/<name>` | `<project>/.agents/skills/<name>` |

On Windows, `~` refers to your user profile. Also inspect any custom target used by the former installer. Old flat Claude sources are `pre-launch-checklist.skill` and `vibe-coder-security-checklist.skill` in the same Claude skills directory.

Before changes, record each existing path, whether it is a real directory or a link, its manager, local edits, and the current revision. A matching name alone is not proof of ownership.

Create a dated backup outside all agent skill-discovery directories. Preserve the complete selected folders, any old flat files, local notes, and applicable lockfiles. Skills CLI uses `~/.agents/.skill-lock.json` globally and `skills-lock.json` in a project. Preserve link targets deliberately. Do not move or delete a shared link target merely because one agent points to it.

Review your backup, then move only confirmed legacy Pre-Ship entries out of active discovery paths. Preserve unrelated skills and agent configuration. Rename-within-the-same-skills-directory is not a reliable way to disable a discovered skill.

No bulk deletion command is supplied. Use Explorer, Finder, or individually reviewed moves for the exact paths. Stop when ownership or backup completeness is uncertain.

## 3. Install and establish manager ownership

Use Git and Node.js 22.20.0 or newer. The supported CLI version for this migration is 1.7.2.

```sh
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --list
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --global --agent claude-code codex --skill ship pre-launch-checklist vibe-coder-security-checklist --copy
npx skills@1.7.2 list --global

# Then add the code review skill
npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill --global --agent claude-code codex --skill ai-code-review --copy
```

On Windows, substitute `npx.cmd` when needed to avoid the PowerShell npm shim. Do not use `iex`, remote shell execution, `sudo`, administrator elevation, or an execution-policy bypass.

Review the interactive installation summary. It should name only the three requested skills and the two intended agents. Do not use `--all`, which targets more than this collection. The integration tests use `--yes` only inside disposable fixtures.

For project scope, omit `--global` and run from the intended project root. Do not use a local filesystem source for your persistent installation when remote update tracking is required. Local paths are useful for testing the pending layout.

## 4. Verify before removing backups

Confirm all three names appear in the installation list. Inspect each destination for `SKILL.md`. Ship must also retain its `references`, `scripts`, and `templates`, including both backend review documents and `preflight.py`.

Confirm each of the three manager-lock entries records the intended repository source and its path under `skills/`. Listing a folder alone does not prove remote updates are tracked. Verify the recorded scope and source ref. Do not manually fabricate a lock entry.

Restart your coding-agent session and verify discovery of `$ship` or `/ship` and the two specialists. The CI tests do not launch these agent applications, so this final discovery check runs on your machine.

Keep local customizations in a separate owned skill or a reviewed fork. Do not copy old modified instructions back over manager-owned files. After migration, stop using the legacy installer on these same destinations.

## 5. Updates and version control

Review upstream changes and back up installed content before an update. An update is a write operation, not a read-only preview.

```sh
# Global: only this collection
npx skills@1.7.2 update ship pre-launch-checklist vibe-coder-security-checklist ai-code-review --global
npx skills@1.7.2 list --global

# Project: run from the intended project root
npx skills@1.7.2 update ship pre-launch-checklist vibe-coder-security-checklist ai-code-review --project
npx skills@1.7.2 list
```

Skills CLI tracks source content separately from npm package versions. Updating the old npm package does not update Skills CLI-owned copies. Likewise, a Skills CLI update does not publish this repository to npm.

The `skills@1.7.2` pin fixes the manager version only. To hold an approved skill revision, install from an explicitly reviewed full Git commit source, using the CLI's `#ref` source syntax. Verify the resulting lock entry contains the approved ref. Do not insert a guessed revision or a mutable tag and call it immutable. Updates against a fixed ref remain tied to it. Advancing requires an explicit install from a new reviewed ref.

## 6. Rollback

Pause agent sessions. Record the failed installation and its source revision. Remove only the three selected Skills CLI entries through its scoped remove command after reviewing affected agents. Do not remove all skills or replace an entire lockfile blindly.

Restore the backed-up selected folders and links, then verify discovery and file hashes. Restore only the relevant manager metadata when other skills changed since the backup. Preserve unrelated entries. Returning to the old installer requires an explicit ownership handoff.

A Git revert in this repository does not restore user-machine installations. Keep the backup until both agent discovery and one controlled update have been verified.

## 7. Verification limits

CI uses the actual pinned Skills CLI, a temporary home, both agents, both scopes, and a disposable Git-backed update fixture. No production data, existing user skill directories, live billing, or remote repository writes participate.

The source-layout move preserves the existing audit content. It does not certify the safety of every future upstream CLI version or skill revision.

## Sources

[Skills CLI commands and source formats](https://github.com/vercel-labs/skills)

[Agent Skills specification](https://agentskills.io/specification)
