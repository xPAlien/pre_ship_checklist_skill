# Ship Skill | Production Release Gate

A reusable, evidence-based release readiness workflow for Codex and Claude Code. Also supported by compatible AgentSkills agents. It reviews websites, apps, APIs, Vercel projects, and AI services. The default action is an audit, not a deployment.

Version 0.4.0 | Backend review update 2026-10-12

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

## Install globally or per project

The repository's npm installer installs the full `ship/` folder and two independent specialist audits. It manages files without deleting local modifications.

```sh
npx pre-ship-checklist-skill install --agent codex
npx pre-ship-checklist-skill install --agent claude
```

For one project, add `--scope project`. For one skill only, add `--only ship`. Run `doctor --agent codex` or `doctor --agent claude` afterward. Review existing changed skill files before using `--force`.

Existing flat Claude `.skill` files from v0.2.x are not deleted by this installer. After verifying folder-based installations, remove obsolete copies manually to avoid duplicate triggers.

The full three-skill package is available through `pre-ship-checklist-skill install`. Goose receives a compact `.goosehints` summary, not the full skill directory.

## Invocation

In Codex, invoke `$ship` and specify `audit this project for production`. In Claude Code, enter `/ship` to run a production-readiness review. To request code corrections, explicitly authorize a named scope after reading the initial findings.

Suggested example:

```text
$ship Audit this repository for a Vercel production launch. Run read-only checks first. Evaluate all applicable gates, preserve Deployment Protection, and report GO or NO-GO with evidence. Do not merge, deploy, rotate keys, migrate production data, or alter Vercel settings.
```

For Claude Code, replace `$ship` with `/ship`.

## Offline helper

Use the lightweight read-only helper from the skill folder:

```powershell
python .\scripts\preflight.py --root "C:\path\to\my\repository"
```

It reports structural hints about the repository and selected high-confidence secret patterns in tracked files. It makes no network requests and changes no project files. Its result is not a security assessment or release decision. Run a dedicated secret scanner across Git history as part of an actual release review.

Test the helper:

```powershell
python -m unittest discover -s .\tests -v
```

## Release policy

- `GO` means applicable critical checks passed on observed evidence. It is not release authorization.
- `CONDITIONAL GO` still requires critical controls to pass, with only bounded lower-priority gaps.
- `NO-GO` blocks release for any critical failure or unresolved critical verification.
- The release operator needs explicit authorization for the exact revision, production environment, and domain.
- This skill does not technically prevent deployment. Enforce required checks and approvals through Git provider branch policies and the deployment provider.

## Backend release review

The 25 backend source items supplement the original 40. See `references/backend-controls.md` for coverage and primary sources. See `references/backend-review.md` for read-only review, approval, one-writer fixes, and owner actions. The review works sequentially or through supported read-only delegation. It does not require a specific model.

## Notes

- Vercel-specific checks apply only to Vercel-hosted units. Other hosting platforms follow equivalent controls.
- Marketing features, public SEO, privacy consent, and legal terms are conditional on project purpose and obligations.
- The skill stores supporting checklists separately to keep the main instructions focused.
- Primary documentation links appear in `references/official-sources.md`.
