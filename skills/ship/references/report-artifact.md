# Report artifact contract

The Ship decision has one machine-readable source, `.ship/report.json`. Markdown, HTML, hooks, and CI read the same file. This keeps the verdict, revision, and findings consistent everywhere they appear.

## 1. Consent and location

- Offer the artifact once per audit. Write nothing until the user agrees.
- Default location is `.ship/report.json` in the audited project. Use another path only when the user names it.
- Ask whether `.ship/` belongs in version control. A report with vulnerability details usually stays out of Git. Suggest adding `.ship/` to `.gitignore` when the team keeps reports private.
- In `audit` mode this file is the only project write, and only after consent.

## 2. Build the record

1. Run `python "${CLAUDE_SKILL_DIR}/scripts/report.py" skeleton --root <repo>`. It fills the current SHA and branch and starts at `NO-GO` with every gate `NEEDS VERIFICATION`.
2. Fill gates, findings, evidence, unrun checks, backend coverage, owner actions, and the runbook from the audit. Every finding needs controls, severity, status, evidence location, smallest fix, and owner.
3. Cite controls by stable ID: `Gx-NN`, `BE-NN`, `PL-NN` for pre-launch items, `SEC-NN` for security items, `CR-x.y` for code review items, `V1` to `V9` for Vercel playbook sections.
4. Cite evidence by location: file and line, command, dashboard page, or test name. Never paste a credential, token, signed URL, bypass secret, or customer record.

## 3. Validate

`report.py validate .ship/report.json --root <repo>` checks:

- Schema shape and enumerations from `templates/ship-report.schema.json`.
- Release policy: open P0 or P1, a critical unknown, or a failing critical gate forces `NO-GO`. `GO` and `CONDITIONAL GO` need a release owner, a release mechanism, and a rollback route. Open P2 findings need `CONDITIONAL GO` with `due` and `accepted_by`. A production action needs a recorded authorization.
- Backend coverage, when present, lists BE-01 through BE-25 exactly once, with reasons for N/A and finding IDs for failures.
- Secret content: the same high-confidence patterns as the preflight scanner, service-role JWTs, and protection bypass values.
- Freshness: with `--root`, a SHA different from HEAD prints a STALE warning.

Fix the record when validation fails. Never weaken the policy to reach a verdict.

## 4. Render

- `report.py render .ship/report.json --format md` prints the Markdown release record.
- `report.py render .ship/report.json --format html` prints one self-contained HTML page with no external requests. It carries a private-record banner and a `noindex` tag. It works in light and dark mode and at phone width.

Rendering refuses an invalid report, so a rendered page always matches the release policy.

## 5. Publishing

- Publish only to a private destination, such as a private Claude artifact, after the user agrees.
- Re-read the rendered content for private topology, internal hostnames, and vulnerability details before publishing. Redact or summarize anything a reader outside the release team should not see.
- Never publish a report with an open P0 security finding outside the incident's approved private channel.
- A published page is a record, not approval. The release still needs explicit authorization for the exact action, target, and revision.
