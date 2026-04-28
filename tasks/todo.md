# npm Installer Update

## Plan

- [x] Inspect the existing skill repository.
- [x] Add package metadata for npm, npx, global install, and project install.
- [x] Add a CLI installer that copies the existing `.skill` files to a target skills directory.
- [x] Update the README with npx, global, project, and manual install instructions.
- [x] Add focused tests for CLI behavior.
- [x] Verify tests, package contents, and local npx execution.
- [x] Commit and push to `xPAlien/pre_ship_checklist_skill`.

## Notes

- Preserve the existing `.skill` files as the source of truth.
- Keep npm packaging files minimal and avoid changing checklist content unless required.

## Verification

- PASS: `npm view pre-ship-checklist-skill name version` returned `E404 Not Found`, so the package name appears available.
- PASS: `npm test` ran 6 Node tests successfully.
- PASS: `npm run pack:dry-run` included both `.skill` files, docs, package metadata, and installer CLI.
- PASS: `npx --yes --package . pre-ship-checklist-skill list` listed both packaged skill files.
- PASS: Commit `7427458` pushed to `origin/master`.
- PASS: `pre-ship-checklist-skill@0.1.0` was published to npm and verified with `npm view pre-ship-checklist-skill version`.

## Repository Audit Plan

- [x] Review package metadata and npm publish surface.
- [x] Review installer CLI behavior and edge cases.
- [x] Review tests for meaningful coverage gaps.
- [x] Review docs for stale or unnecessary content.
- [x] Run verification commands and summarize findings.

## Repository Audit Results

- PASS: `npm test` passed 6/6 tests.
- PASS: `npm run pack:dry-run` published only the expected package surface: docs, license, CLI, package metadata, and both `.skill` files.
- PASS: `npx --yes pre-ship-checklist-skill@latest list` ran from the npm registry and listed both skills.
- NOTE: `npm audit --omit=dev` cannot run because the repo has no lockfile.
- FINDING: npm registry README for `0.1.0` is stale compared with GitHub because README updates happened after the package publish.
- FINDING: npm package metadata is missing `repository`, `homepage`, and `bugs` links.
- CLEANUP: `tasks/` is useful for our workflow but not needed by package consumers and is excluded from the npm tarball.

## Multi-Agent Install Plan

- [x] Add `--agent` and `--scope` installer options.
- [x] Preserve current Claude-style `.skill` install behavior.
- [x] Add AgentSkills folder installs for OpenClaw, Hermes, Pi, and generic `.agents` directories.
- [x] Add Goose `.goosehints` install adapter.
- [x] Add package metadata links and a lockfile for auditability.
- [x] Update README examples and tests.
- [x] Verify package, tests, npm audit, and local CLI behavior.

## Multi-Agent Install Verification

- PASS: `npm install --package-lock-only` created a lockfile and reported 0 vulnerabilities.
- PASS: `npm test` ran 10 tests successfully.
- PASS: `npm run pack:dry-run` produced `pre-ship-checklist-skill-0.2.0.tgz` with the expected package surface.
- PASS: `npm audit --omit=dev` found 0 vulnerabilities.
- PASS: local npx dry-run works for `--agent openclaw`.
- PASS: local npx dry-run works for `--agent goose`.
