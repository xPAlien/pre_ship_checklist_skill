# Contributing

## Source layout

The project contains an eight-gate release coordinator in `ship/` and two independent specialists in the root `.skill` files. Keep all three usable separately. Reuse risk evidence and deduplicate findings when the main `ship` skill coordinates an audit.

## Propose a checklist change

Record the risk, affected project types, evidence for the control, severity when applicable, and smallest practical correction. Avoid universal requirements for stack- or risk-specific features. Examples: public sites do not need auth, internal APIs do not need sitemaps, and managed platforms do not always need read replicas or separate WebSocket hosts.

The specialist audits retain 25 and 36 numbered checks. Preserve numbering and update any summaries when items change. The central Ship checklist uses stable `Gx-NN` identifiers. Map newly added source material and avoid duplicate checks.

## Submit a PR

1. Branch from `master` and keep the scope reviewable.
2. Update the appropriate skill files and documentation.
3. Add regression tests for changed installer behavior or preflight logic.
4. Run `npm test`, `python -m unittest discover -s ship/tests -v`, and `npm pack --dry-run`.
5. Confirm both `--agent codex` and `--agent claude` still install all managed files into skill folders, and that `--dry-run` leaves the destination unchanged.
6. Include the release impact, version bump, tests, and any migration notes in the PR description.

Never merge, publish npm, or deploy another project without separate authorization.

## Severity and applicability

The specialist checklists use baseline `[BLOCKER]` and `[WARNING]` labels to prompt risk review. The Ship release decision is based on actual applicability, evidence, and P0 through P3 risk. A baseline label alone does not establish a universal deployment requirement. Unknown critical controls remain release blockers. Findings need observed evidence rather than only user assurances.

## Distribution

Keep the npm `files` allowlist accurate. Every AgentSkills target receives a directory with `SKILL.md`, and the full Ship folder retains references and preflight helpers. The original root `.skill` sources remain for compatibility. Never silently remove existing user modifications during installation.
