# Ship Report | <project> | <date>

<!-- Machine-readable source: .ship/report.json (templates/ship-report.schema.json). Render with scripts/report.py render --format md. -->

## Decision

- Verdict: `GO` / `CONDITIONAL GO` / `NO-GO`
- Revision: `<full SHA>`
- Target: `<provider, environment, domain>`
- Release owner: `<name or unresolved>`
- Audit evidence timestamp: `<UTC timestamp>`
- Approval status: `NOT REQUESTED` / `PENDING` / `AUTHORIZED FOR SPECIFIC ACTION`
- Production action performed: `NO` unless independently proven

## 1. Scope

- Application type:
- Framework and major integrations:
- Public / private audience:
- Production state and deployment protection:
- Applicable security, data, commerce, AI, SEO, and legal categories:
- Non-applicable categories, with reason:

## 2. Gate decisions

| Gate | PASS | FAIL | NEEDS VERIFICATION | NOT APPLICABLE | Gate decision |
| --- | ---: | ---: | ---: | ---: | --- |
| G0 Release control | 0 | 0 | 0 | 0 | TBD |
| G1 Security | 0 | 0 | 0 | 0 | TBD |
| G2 Data and recovery | 0 | 0 | 0 | 0 | TBD |
| G3 Function and access | 0 | 0 | 0 | 0 | TBD |
| G4 Mobile and speed | 0 | 0 | 0 | 0 | TBD |
| G5 Search and privacy | 0 | 0 | 0 | 0 | TBD |
| G6 Hosting and operations | 0 | 0 | 0 | 0 | TBD |
| G7 Cutover | 0 | 0 | 0 | 0 | TBD |

## 3. Findings, sorted by severity

| ID | Severity | Status | Finding and impact | Evidence | Smallest fix | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `<check-id>` | `P0/P1/P2/P3` | `FAIL` | `<specific issue>` | `<file, test, URL or dashboard>` | `<action>` | `<owner>` |

## 4. Evidence ledger

| Check | Command or observation | Result | Revision or environment | When |
| --- | --- | --- | --- | --- |
| `<ID>` | `<safe command or inspection>` | `PASS/FAIL/UNKNOWN` | `<SHA or URL>` | `<UTC>` |

### Not executed or not accessible

- `<check>`: `<reason>`. Required next evidence: `<specific action>`.

## 5. Remediation order

1. P0 and P1 failures. Owner, test, and approval.
2. P2 risks. Fix or accept with reason, owner, and due date.
3. P3 improvements after launch.

## 6. Release runbook

- Immutable candidate revision:
- Verified preview or staging deployment:
- Production variable differences:
- Production release mechanism and implicit auto-deploy behavior:
- Access protection expected before and after release:
- Database migration order and compatibility:
- Release action requested, not yet authorized:
- Final approving person and record:

## 7. Production smoke checklist

- [ ] DNS, TLS, canonical domain, and HTTP status
- [ ] Public entry route and primary user journey
- [ ] Protected route rejection without authorization
- [ ] Successful authenticated journey with approved test identity
- [ ] Critical API or database read and write without unsafe live-test mutations
- [ ] Payment, email, queue, and AI flows as applicable using controlled test paths
- [ ] Error logs, alert route, and latency checked after release
- [ ] Revision and deployment ID match approved target

## 8. Rollback and monitoring

- Last known healthy revision:
- Rollback operator and required access:
- Vercel or other host rollback mechanism:
- Data migration compatibility and external side effects:
- Rollback triggers:
- First-hour checks and responsible person:
- Recovery verification and domain auto-assignment status:

## 9. Backend review record

- Execution mode: `SEQUENTIAL` or `DELEGATED`
- Reviewers who ran, assigned scope, and enforced tool restrictions:
- Source coverage: original 40 plus 25 backend items, with overlapping findings deduplicated
- Unrun groups and access restrictions:

### Backend coverage ledger

Include one row per BE-01 through BE-25. Link overlapping controls to the same finding without skipping applicability decisions.

| Control | Applicable? | Status | Severity | Evidence location and time | Revision/environment | Finding ID or N/A reason |
| --- | --- | --- | --- | --- | --- | --- |
| `<BE-ID>` | `<yes/no/unknown>` | `<PASS/FAIL/NEEDS VERIFICATION/NOT APPLICABLE>` | `<P0-P3>` | `<sanitized reference>` | `<exact scope>` | `<finding or reason>` |

### Owner actions and business decisions

| Control | Provider/account/environment | Current evidence | Missing decision or proposed setting | Approval and operator | Steps and verification | Rollback or containment |
| --- | --- | --- | --- | --- | --- | --- |
| `<BE-ID>` | `<non-secret identifiers>` | `<verified or unknown>` | `<budget, quota, grace period, retention, MFA, renewal, or other setting>` | `<pending/named approval>` | `<documented steps>` | `<plan>` |

### Cleanup proposals, not deletion approval

| Exact record ID | Environment | Fixture provenance | Retention/dependency impact | Proposed action | Separate approval |
| --- | --- | --- | --- | --- | --- |
| `<ID>` | `<target>` | `<verified source or unknown>` | `<impact>` | `<retain/review/remove>` | `<pending>` |

Keep sensitive evidence in an approved private location. Do not include secret values, customer records, full signed URLs, or recovery codes in this report.

### Fix and retest summary

- Approved change scope and one designated writer:
- Files changed and resulting revision:
- Regression tests executed and observed outcomes:
- Checks not run and remaining owner actions:
- Production changes performed: `NONE` unless separately authorized and verified

## 10. Final approval

Release remains unauthorized until a person approves a specific production action for the exact target and revision. A GO verdict is technical readiness, not an instruction to publish.
