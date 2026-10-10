# Make the Release Gate Enforceable

A skill produces a documented decision. It does not replace permission boundaries or CI enforcement. Configure these controls per repository after examining the existing stack and deploy trigger. Do not add a generic YAML workflow without checking its compatibility.

## Minimum Git provider policy

1. Require reviewed PRs into the production branch. Restrict direct pushes and bypass privileges as appropriate to the team.
2. Require the existing checks appropriate to the project: build, tests, typecheck, lint, dependency scan, and targeted end-to-end tests.
3. Require status checks against the exact revision being merged. Keep lockfiles committed and pin CI dependencies or action revisions according to repository policy.
4. Keep CI identities least-privileged. Never expose production credentials to untrusted PR builds.
5. Restrict deployment credentials and environment approval to named release operators when provider support permits.
6. Prevent automated promotion of a preview into a public production domain without intended approval controls.
7. Document and test the path from code merge to production. A green PR alone is not deployment approval if merge triggers Vercel production automatically.

## Vercel integration policy

- Inspect production branch tracking and auto-assignment of production domains.
- Choose either governed auto-release after required checks or a staged production deployment with explicit promotion. Follow provider functionality and project needs.
- For private builds, enable and test Deployment Protection before sharing a domain.
- Keep production-domain protection in place until a separately approved public launch.
- Prefer environment-scoped secrets and controlled access to project settings.
- Never publish the full Ship report if it includes private topology, vulnerability details, customer data, or protected deployment URLs. Redact or store privately.

## Failing release policy

- `P0` and `P1` fail the human release decision and must be integrated with mandatory checks where programmatic verification is available.
- `NEEDS VERIFICATION` on a critical control also blocks the human release decision.
- A status-only pull request comment is not a reliable enforcement mechanism unless an independent required check validates its result.
- Exceptions require an authorized owner, explicit reason, target revision, and expiration. Critical access control and data safety issues are not waived by a cosmetic score.

## Avoid common mistakes

- Do not let the skill automatically promote a deployment after evaluating its own output.
- Do not treat a reviewer click on a PR as approval to disable protection or rotate a credential.
- Do not test transactions, live emails, or irreversible jobs in production without a controlled and approved runbook.
- Do not merge to a production-tracked branch merely to test whether auto-deploy works.
