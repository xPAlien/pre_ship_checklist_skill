#!/usr/bin/env python3
"""Validate and render a Ship release report. Offline, Python 3.10+, standard library only.

Commands:
  skeleton --root <repo> [--project NAME]     Print a starting report.json with revision filled in.
  validate <report.json> [--root <repo>]      Check schema, release policy, and secret-like content.
  render <report.json> --format md|html       Print a Markdown or self-contained HTML view.

Rendering refuses a report that fails validation. A rendered page is a private record.
It is never a release approval and never safe for a public URL without a separate redaction review.
Exit codes: 0 valid, 1 invalid or blocked, 2 usage or file error.
"""

import argparse
import html
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMA_PATH = HERE.parent / "templates" / "ship-report.schema.json"
sys.dont_write_bytecode = True  # Never write caches into an installed skill folder.
sys.path.insert(0, str(HERE))
from preflight import JWT, SECRET_PATTERNS, jwt_service_role_lines  # noqa: E402

GATE_NAMES = {
    "G0": "Release control", "G1": "Security", "G2": "Data and recovery", "G3": "Function and access",
    "G4": "Mobile and speed", "G5": "Search and privacy", "G6": "Hosting and operations", "G7": "Cutover",
}
SEVERITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
BACKEND_IDS = [f"BE-{i:02d}" for i in range(1, 26)]
PROTECTION_BYPASS = re.compile(r"x-vercel-protection-bypass\s*[:=]\s*\S{8,}|[?&]x-vercel-protection-bypass=\S{8,}", re.I)


# Minimal JSON Schema interpreter for the keywords used in ship-report.schema.json.
def schema_errors(value, schema, path="$"):
    errors = []
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in {schema['enum']}")
    expected = schema.get("type")
    if expected:
        types = expected if isinstance(expected, list) else [expected]
        checks = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
            "null": lambda v: v is None,
        }
        if not any(checks[t](value) for t in types):
            return errors + [f"{path}: expected {expected}"]
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: empty")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match {schema['pattern']}")
    if isinstance(value, int) and not isinstance(value, bool) and value < schema.get("minimum", value):
        errors.append(f"{path}: below minimum")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: needs at least {schema['minItems']} item(s)")
        if "items" in schema:
            for i, item in enumerate(value):
                errors += schema_errors(item, schema["items"], f"{path}[{i}]")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing {key}")
        props = schema.get("properties", {})
        patterns = schema.get("patternProperties", {})
        for key, item in value.items():
            if key in props:
                errors += schema_errors(item, props[key], f"{path}.{key}")
                continue
            matched = [s for p, s in patterns.items() if re.search(p, key)]
            for sub in matched:
                errors += schema_errors(item, sub, f"{path}.{key}")
            if not matched and schema.get("additionalProperties") is False:
                errors.append(f"{path}: unexpected key {key}")
    return errors


def strings(value, path="$"):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from strings(item, f"{path}.{key}")
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from strings(item, f"{path}[{i}]")


def secret_errors(report):
    errors = []
    for path, text in strings(report):
        for label, regex in SECRET_PATTERNS.items():
            if regex.search(text):
                errors.append(f"{path}: contains a {label} pattern. Remove the value and cite its location instead.")
        if JWT.search(text) and jwt_service_role_lines(text):
            errors.append(f"{path}: contains a service_role JWT. Remove the value.")
        if PROTECTION_BYPASS.search(text):
            errors.append(f"{path}: contains a deployment protection bypass value. Remove it.")
    return errors


def open_findings(report):
    return [f for f in report.get("findings", []) if f.get("status") in ("FAIL", "NEEDS VERIFICATION")]


def policy_errors(report):
    """Cross-field rules from the Ship release policy (SKILL.md section 6)."""
    errors = []
    verdict = report["verdict"]
    findings = open_findings(report)
    blockers = [f["id"] for f in findings if f["severity"] in ("P0", "P1")]
    critical_unknowns = [f["id"] for f in findings if f["critical"] and f["status"] == "NEEDS VERIFICATION"]
    critical_gates = [g for g, d in report["gates"].items() if d["critical"] and d["decision"] in ("FAIL", "NEEDS VERIFICATION")]
    for gate in ("G0", "G1"):
        if not report["gates"][gate]["critical"]:
            errors.append(f"gates.{gate}: G0 and G1 are always critical")
    if verdict != "NO-GO":
        if blockers:
            errors.append(f"verdict {verdict} with open P0/P1 findings: {', '.join(blockers)}. Policy requires NO-GO.")
        if critical_unknowns:
            errors.append(f"verdict {verdict} with critical unknowns: {', '.join(critical_unknowns)}. Policy requires NO-GO.")
        if critical_gates:
            errors.append(f"verdict {verdict} with critical gates not passing: {', '.join(critical_gates)}. Policy requires NO-GO.")
        if not report.get("release_owner"):
            errors.append(f"verdict {verdict} needs a known release_owner")
        runbook = report.get("runbook") or {}
        if not runbook.get("rollback") or not runbook.get("release_mechanism"):
            errors.append(f"verdict {verdict} needs runbook.release_mechanism and runbook.rollback")
    p2 = [f for f in findings if f["severity"] == "P2"]
    if verdict == "GO" and p2:
        errors.append("verdict GO with open P2 findings. Use CONDITIONAL GO with documented acceptance, or fix them.")
    if verdict == "CONDITIONAL GO":
        if not [f for f in findings if f["severity"] in ("P2", "P3")]:
            errors.append("verdict CONDITIONAL GO without any open P2 or P3 finding. Use GO.")
        for f in p2:
            if not f.get("due") or not f.get("accepted_by"):
                errors.append(f"finding {f['id']}: CONDITIONAL GO needs due and accepted_by on every open P2")
    if report["production_action_performed"] and report["approval"]["status"] != "AUTHORIZED FOR SPECIFIC ACTION":
        errors.append("production_action_performed is true without AUTHORIZED FOR SPECIFIC ACTION approval")
    if report["approval"]["status"] == "AUTHORIZED FOR SPECIFIC ACTION":
        for key in ("action", "approver"):
            if not report["approval"].get(key):
                errors.append(f"approval.{key} is required for an authorized action")
    ids = [f["id"] for f in report["findings"]]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        errors.append(f"duplicate finding IDs: {', '.join(duplicates)}")
    coverage = report.get("backend_coverage")
    if coverage:
        controls = [row["control"] for row in coverage]
        if sorted(controls) != BACKEND_IDS:
            errors.append("backend_coverage must list BE-01 through BE-25 exactly once")
        for row in coverage:
            if row["status"] == "NOT APPLICABLE" and not row.get("reason"):
                errors.append(f"backend_coverage {row['control']}: NOT APPLICABLE needs a reason")
            if row["status"] in ("FAIL", "NEEDS VERIFICATION") and not row.get("finding"):
                errors.append(f"backend_coverage {row['control']}: {row['status']} needs a finding ID")
            if row.get("finding") and row["finding"] not in ids:
                errors.append(f"backend_coverage {row['control']}: unknown finding {row['finding']}")
    return errors


def head_sha(root):
    try:
        out = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return out.stdout.decode().strip() if out.returncode == 0 else None


def validate(report, root=None):
    """Return (errors, warnings)."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    errors = schema_errors(report, schema)
    if errors:
        return errors, []
    errors = policy_errors(report) + secret_errors(report)
    warnings = []
    if root is not None:
        sha = head_sha(root)
        if sha is None:
            warnings.append("Git HEAD unavailable. Report freshness not verified.")
        elif sha != report["revision"]["sha"]:
            warnings.append(f"STALE: report revision {report['revision']['sha'][:12]} differs from HEAD {sha[:12]}. Re-run the audit.")
    return errors, warnings


def skeleton(root, project):
    sha = head_sha(root) or "0" * 40
    branch = subprocess.run(["git", "-C", str(root), "rev-parse", "--abbrev-ref", "HEAD"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False).stdout.decode().strip()
    gate = {"pass": 0, "fail": 0, "needs_verification": 0, "not_applicable": 0, "decision": "NEEDS VERIFICATION", "critical": True}
    return {
        "schema_version": "1.0",
        "project": project or Path(root).resolve().name,
        "generated_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "mode": "audit",
        "revision": {"sha": sha, "branch": branch or "unknown", "dirty": False},
        "target": {"provider": "unknown", "environment": "production"},
        "verdict": "NO-GO",
        "release_owner": None,
        "approval": {"status": "NOT REQUESTED"},
        "production_action_performed": False,
        "profile": {"application_type": "", "audience": "", "applicable": [], "not_applicable": []},
        "gates": {g: dict(gate) for g in GATE_NAMES},
        "findings": [],
        "evidence": [],
        "not_executed": [],
        "owner_actions": [],
        "runbook": {},
    }


def sorted_findings(report):
    return sorted(report["findings"], key=lambda f: (SEVERITY_ORDER[f["severity"]], f["id"]))


def md_cell(text):
    return str(text if text is not None else "").replace("|", "\\|").replace("\n", " ")


def render_md(report):
    r = report
    out = [f"# Ship Report | {r['project']} | {r['generated_utc'][:10]}", "", "## Decision", ""]
    out += [
        f"- Verdict: `{r['verdict']}`",
        f"- Revision: `{r['revision']['sha']}`",
        f"- Target: `{r['target']['provider']}, {r['target']['environment']}, {r['target'].get('domain', 'no domain recorded')}`",
        f"- Release owner: `{r.get('release_owner') or 'unresolved'}`",
        f"- Audit evidence timestamp: `{r['generated_utc']}`",
        f"- Approval status: `{r['approval']['status']}`",
        f"- Production action performed: `{'YES' if r['production_action_performed'] else 'NO'}`",
        "", "## Gate decisions", "",
        "| Gate | PASS | FAIL | NEEDS VERIFICATION | NOT APPLICABLE | Critical | Gate decision |",
        "| --- | ---: | ---: | ---: | ---: | --- | --- |",
    ]
    for g, name in GATE_NAMES.items():
        d = r["gates"][g]
        out.append(f"| {g} {name} | {d['pass']} | {d['fail']} | {d['needs_verification']} | {d['not_applicable']} | {'yes' if d['critical'] else 'no'} | {d['decision']} |")
    out += ["", "## Findings, sorted by severity", ""]
    if r["findings"]:
        out += ["| ID | Severity | Status | Controls | Finding | Evidence | Smallest fix | Owner |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for f in sorted_findings(r):
            out.append("| " + " | ".join(md_cell(x) for x in (f["id"], f["severity"], f["status"], ", ".join(f["controls"]), f["title"], f["evidence"], f["fix"], f["owner"])) + " |")
    else:
        out.append("No open findings recorded.")
    if r.get("evidence"):
        out += ["", "## Evidence ledger", "", "| Check | Observation | Result | Scope | When |", "| --- | --- | --- | --- | --- |"]
        for e in r["evidence"]:
            out.append("| " + " | ".join(md_cell(e[k]) for k in ("check", "observation", "result", "scope", "when")) + " |")
    if r.get("not_executed"):
        out += ["", "### Not executed or not accessible", ""]
        out += [f"- {n['check']}: {n['reason']}. Required next evidence: {n['next']}." for n in r["not_executed"]]
    if r.get("backend_coverage"):
        out += ["", "## Backend coverage ledger", "", "| Control | Applicable | Status | Finding or reason |", "| --- | --- | --- | --- |"]
        for row in sorted(r["backend_coverage"], key=lambda x: x["control"]):
            out.append(f"| {row['control']} | {row['applicable']} | {row['status']} | {md_cell(row.get('finding') or row.get('reason', ''))} |")
    if r.get("owner_actions"):
        out += ["", "## Owner actions and business decisions", "", "| Control | Scope | Decision needed | Approval | Steps |", "| --- | --- | --- | --- | --- |"]
        for a in r["owner_actions"]:
            out.append("| " + " | ".join(md_cell(a.get(k, "")) for k in ("control", "scope", "decision_needed", "approval", "steps")) + " |")
    rb = r.get("runbook") or {}
    if rb:
        out += ["", "## Release runbook", ""]
        for key in ("release_mechanism", "preview_deployment", "last_known_good", "rollback", "monitoring_window"):
            if rb.get(key):
                out.append(f"- {key.replace('_', ' ').capitalize()}: {rb[key]}")
        for key in ("rollback_triggers", "smoke_checks"):
            if rb.get(key):
                out.append(f"- {key.replace('_', ' ').capitalize()}:")
                out += [f"  - {item}" for item in rb[key]]
    out += ["", "## Final approval", "", "Release remains unauthorized until a person approves a specific production action for the exact target and revision. A GO verdict is technical readiness, not an instruction to publish.", ""]
    return "\n".join(out)


HTML_STYLE = """
:root{--bg:#f7f7f5;--fg:#1c1c1a;--muted:#5d5d58;--card:#fff;--line:#deded8;--go:#1f7a3d;--cond:#8a5a00;--nogo:#b42318;--p0:#b42318;--p1:#c2410c;--p2:#8a5a00;--p3:#4b5563;--chip:#efefea}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141413;--fg:#ececea;--muted:#a3a39d;--card:#1e1e1c;--line:#34342f;--go:#4ade80;--cond:#fbbf24;--nogo:#f87171;--p0:#f87171;--p1:#fb923c;--p2:#fbbf24;--p3:#9ca3af;--chip:#2a2a27}}
:root[data-theme="dark"]{--bg:#141413;--fg:#ececea;--muted:#a3a39d;--card:#1e1e1c;--line:#34342f;--go:#4ade80;--cond:#fbbf24;--nogo:#f87171;--p0:#f87171;--p1:#fb923c;--p2:#fbbf24;--p3:#9ca3af;--chip:#2a2a27}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:32px 0 12px}
.muted{color:var(--muted)}.banner{border:1px solid var(--line);background:var(--card);padding:10px 14px;border-radius:8px;font-size:.9rem;margin:16px 0}
.verdict{display:flex;flex-wrap:wrap;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:16px}
.badge{font-weight:700;font-size:1.25rem;padding:6px 14px;border-radius:999px;border:2px solid currentColor}
.v-GO{color:var(--go)}.v-CONDITIONAL{color:var(--cond)}.v-NO-GO{color:var(--nogo)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0;font-size:.9rem}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
.table{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}table{border-collapse:collapse;width:100%;font-size:.88rem}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
.sev{font-weight:700;padding:1px 8px;border-radius:6px;background:var(--chip)}.P0{color:var(--p0)}.P1{color:var(--p1)}.P2{color:var(--p2)}.P3{color:var(--p3)}
.d-PASS{color:var(--go)}.d-FAIL{color:var(--nogo)}.d-NEEDS{color:var(--cond)}code{font-size:.85em;overflow-wrap:anywhere}
ul{padding-left:20px}
"""


def render_html(report):
    e = lambda x: html.escape(str(x if x is not None else ""))  # noqa: E731
    r = report
    verdict_class = {"GO": "v-GO", "CONDITIONAL GO": "v-CONDITIONAL", "NO-GO": "v-NO-GO"}[r["verdict"]]
    counts = {s: sum(1 for f in open_findings(r) if f["severity"] == s) for s in SEVERITY_ORDER}
    parts = [
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
        f"<title>Ship Report</title><meta name=\"robots\" content=\"noindex,nofollow\"><style>{HTML_STYLE}</style></head><body><main>",
        f"<h1>Ship Report: {e(r['project'])}</h1><div class=\"muted\">Generated {e(r['generated_utc'])} in {e(r['mode'])} mode</div>",
        "<div class=\"banner\">Private release record. Not an approval to deploy. Do not publish to a public URL.</div>",
        f"<section class=\"verdict\"><span class=\"badge {verdict_class}\">{e(r['verdict'])}</span><dl>",
        f"<dt>Revision</dt><dd><code>{e(r['revision']['sha'])}</code> {e(r['revision'].get('branch', ''))}</dd>",
        f"<dt>Target</dt><dd>{e(r['target']['provider'])} / {e(r['target']['environment'])} {e(r['target'].get('domain', ''))}</dd>",
        f"<dt>Release owner</dt><dd>{e(r.get('release_owner') or 'unresolved')}</dd>",
        f"<dt>Approval</dt><dd>{e(r['approval']['status'])}</dd>",
        f"<dt>Production action</dt><dd>{'YES' if r['production_action_performed'] else 'NO'}</dd>",
        "<dt>Open findings</dt><dd>" + " ".join('<span class="sev %s">%s %d</span>' % (s, s, n) for s, n in counts.items()) + "</dd></dl></section>",
        "<h2>Gates</h2><div class=\"table\"><table><thead><tr><th>Gate</th><th>Pass</th><th>Fail</th><th>Needs verification</th><th>N/A</th><th>Critical</th><th>Decision</th></tr></thead><tbody>",
    ]
    for g, name in GATE_NAMES.items():
        d = r["gates"][g]
        cls = "d-" + d["decision"].split(" ")[0]
        parts.append(f"<tr><td>{g} {name}</td><td>{d['pass']}</td><td>{d['fail']}</td><td>{d['needs_verification']}</td><td>{d['not_applicable']}</td><td>{'yes' if d['critical'] else 'no'}</td><td class=\"{cls}\">{e(d['decision'])}</td></tr>")
    parts.append("</tbody></table></div><h2>Findings</h2>")
    if r["findings"]:
        parts.append("<div class=\"table\"><table><thead><tr><th>Severity</th><th>ID</th><th>Finding</th><th>Evidence</th><th>Smallest fix</th><th>Owner</th></tr></thead><tbody>")
        for f in sorted_findings(r):
            muted = '<br><span class="muted">%s</span>'
            impact = muted % e(f["impact"]) if f.get("impact") else ""
            due = muted % ("due " + e(f["due"])) if f.get("due") else ""
            parts.append(
                '<tr><td><span class="sev %s">%s</span>%s</td>' % (f["severity"], f["severity"], muted % e(f["status"]))
                + "<td>%s%s</td>" % (e(f["id"]), muted % e(", ".join(f["controls"])))
                + "<td>%s%s</td>" % (e(f["title"]), impact)
                + "<td>%s</td><td>%s</td><td>%s%s</td></tr>" % (e(f["evidence"]), e(f["fix"]), e(f["owner"]), due))
        parts.append("</tbody></table></div>")
    else:
        parts.append("<p class=\"muted\">No open findings recorded.</p>")
    if r.get("not_executed"):
        parts.append("<h2>Not executed or not accessible</h2><ul>")
        parts += [f"<li><strong>{e(n['check'])}</strong>: {e(n['reason'])}. Next: {e(n['next'])}</li>" for n in r["not_executed"]]
        parts.append("</ul>")
    rb = r.get("runbook") or {}
    if rb:
        parts.append("<h2>Cutover and rollback</h2><dl>")
        for key in ("release_mechanism", "preview_deployment", "last_known_good", "rollback", "monitoring_window"):
            if rb.get(key):
                parts.append(f"<dt>{e(key.replace('_', ' ').capitalize())}</dt><dd>{e(rb[key])}</dd>")
        parts.append("</dl>")
        for key in ("rollback_triggers", "smoke_checks"):
            if rb.get(key):
                parts.append(f"<h2>{e(key.replace('_', ' ').capitalize())}</h2><ul>" + "".join(f"<li>{e(i)}</li>" for i in rb[key]) + "</ul>")
    parts.append("<p class=\"muted\">A GO verdict is technical readiness, not an instruction to publish. Release remains unauthorized until a person approves a specific production action for the exact target and revision.</p></main></body></html>")
    return "\n".join(parts)


def load(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"Cannot read report: {error}", file=sys.stderr)
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate and render a Ship release report")
    sub = parser.add_subparsers(dest="command", required=True)
    sk = sub.add_parser("skeleton")
    sk.add_argument("--root", default=".")
    sk.add_argument("--project")
    va = sub.add_parser("validate")
    va.add_argument("report")
    va.add_argument("--root", help="Repository to compare HEAD against the report revision")
    re_ = sub.add_parser("render")
    re_.add_argument("report")
    re_.add_argument("--format", choices=("md", "html"), required=True)
    re_.add_argument("--root", help="Repository to compare HEAD against the report revision")
    args = parser.parse_args(argv)

    if args.command == "skeleton":
        print(json.dumps(skeleton(Path(args.root), args.project), indent=2))
        return 0
    report = load(args.report)
    if report is None:
        return 2
    errors, warnings = validate(report, Path(args.root) if args.root else None)
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    if args.command == "validate":
        print(f"valid: {report['verdict']} for {report['revision']['sha'][:12]}")
        return 0
    print(render_md(report) if args.format == "md" else render_html(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
