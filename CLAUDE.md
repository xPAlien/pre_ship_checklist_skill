# Maintainer guidance

This repository distributes three skill packages: the main `ship` release gate and two independent specialist checklists. Do not collapse the specialists into a single checklist. Do not create duplicate findings when the `ship` skill coordinates specialist checks.

## Source ownership

- `skills/ship/SKILL.md`: one evidence-based production release workflow and its GO/NO-GO decision policy.
- `skills/ship/references/`: conditional gate criteria, Vercel-specific guidance, source mapping, and CI policy.
- `skills/ship/scripts/preflight.py`: offline, read-only structural hints, not a GO/NO-GO engine.
- `skills/pre-launch-checklist/SKILL.md`: independent 25-item infrastructure audit.
- `skills/vibe-coder-security-checklist/SKILL.md`: independent 36-item security audit.
- `bin/pre-ship-checklist-skill.js`: installer and self-checker for supported agents.
- `test/cli.test.js` and `skills/ship/tests/`: regression tests.

## Standards

1. All three installed folder-based skills use `<skills>/<name>/SKILL.md`. The three authoritative sources live in `skills/<name>/SKILL.md`. Vercel Skills CLI is the preferred manager. The compatibility installer copies those same folders without converting flat sources.
2. Never delete old skill files or overwrite changed installed files by default. Report collisions before writing anything. `--force` affects only managed paths.
3. Keep two specialist sources independently usable. Keep original checklist item counts accurate. Avoid universal policy claims for inherently conditional requirements.
4. Security, data loss, missing release approval, and critical unknowns fail the central Ship gate. Do not treat an agent report as a CI-enforced block.
5. In `audit` mode, collect evidence without production or Git mutations. No unauthorized deployment, merge, credential rotation, production migration, protection change, or live payment.
6. Every checklist change needs corresponding documentation or regression tests. New checklist items should have stable IDs or a clear ordinal mapping.
7. Keep `package.json` version, root README, and `skills/ship/SKILL.md` metadata aligned on release changes.
8. Check installer `--agent codex`, `--agent claude`, `--scope project`, idempotency, changed-file collisions, and packaged references in tests.

## Required verification

```sh
npm test
python -m unittest discover -s skills/ship/tests -v
npm pack --dry-run
```

Do not merge or publish a release without repository-owner approval. Opening a PR is not permission to deploy.

## Distribution ownership

Use `docs/skills-cli-migration.md` for existing installations. Do not run two managers over one destination. Keep the tested Skills CLI version pinned in documentation and CI. Test discovery, supporting files, global and project installation, and named updates on Windows, macOS, and Linux. Never migrate the operator home directory from CI.
