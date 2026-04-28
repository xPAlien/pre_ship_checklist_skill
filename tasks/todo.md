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
