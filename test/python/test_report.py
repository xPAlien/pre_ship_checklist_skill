"""Regression checks for the Ship report contract, policy, and renderers."""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SHIP = REPO / "skills" / "ship"
sys.dont_write_bytecode = True
sys.path.insert(0, str(SHIP / "scripts"))
import report  # noqa: E402

EXAMPLE = json.loads((SHIP / "templates" / "ship-report.example.json").read_text(encoding="utf-8"))


def clean_go():
    r = copy.deepcopy(EXAMPLE)
    r["findings"] = []
    for gate in r["gates"].values():
        if gate["decision"] != "NOT APPLICABLE":
            gate["decision"] = "PASS"
    r["verdict"] = "GO"
    return r


class ReportTests(unittest.TestCase):
    def errors(self, r):
        return report.validate(r)[0]

    def test_example_is_valid_and_schema_is_json(self):
        json.loads((SHIP / "templates" / "ship-report.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(self.errors(EXAMPLE), [])
        self.assertEqual(self.errors(clean_go()), [])

    def test_schema_rejects_bad_shape(self):
        r = copy.deepcopy(EXAMPLE)
        r["verdict"] = "SHIP IT"
        r["revision"]["sha"] = "abc"
        del r["gates"]["G7"]
        r["findings"][0]["severity"] = "P9"
        errs = " ".join(self.errors(r))
        for text in ("verdict", "sha", "missing G7", "severity"):
            self.assertIn(text, errs)

    def test_policy_forces_no_go(self):
        r = copy.deepcopy(EXAMPLE)
        r["verdict"] = "GO"
        errs = " ".join(self.errors(r))
        self.assertIn("open P0/P1", errs)
        self.assertIn("critical unknowns", errs)
        self.assertIn("critical gates", errs)

    def test_go_needs_owner_and_rollback(self):
        r = clean_go()
        r["release_owner"] = None
        r["runbook"] = {}
        errs = " ".join(self.errors(r))
        self.assertIn("release_owner", errs)
        self.assertIn("rollback", errs)

    def test_conditional_go_needs_accepted_p2(self):
        r = clean_go()
        r["findings"] = [copy.deepcopy(EXAMPLE["findings"][3])]
        self.assertIn("open P2", " ".join(self.errors(r)))
        r["verdict"] = "CONDITIONAL GO"
        self.assertIn("accepted_by", " ".join(self.errors(r)))
        r["findings"][0]["accepted_by"] = "Product owner"
        self.assertEqual(self.errors(r), [])
        r["findings"] = []
        self.assertIn("Use GO", " ".join(self.errors(r)))

    def test_g0_g1_always_critical(self):
        r = clean_go()
        r["gates"]["G1"]["critical"] = False
        self.assertIn("always critical", " ".join(self.errors(r)))

    def test_production_action_needs_authorization(self):
        r = clean_go()
        r["production_action_performed"] = True
        self.assertIn("without AUTHORIZED", " ".join(self.errors(r)))
        r["approval"] = {"status": "AUTHORIZED FOR SPECIFIC ACTION"}
        errs = " ".join(self.errors(r))
        self.assertIn("approval.action", errs)
        r["approval"].update(action="Promote dpl to production", approver="Release owner")
        self.assertEqual(self.errors(r), [])

    def test_backend_coverage_complete_and_linked(self):
        r = clean_go()
        r["backend_coverage"] = [{"control": c, "applicable": "no", "status": "NOT APPLICABLE", "reason": "static"} for c in report.BACKEND_IDS]
        self.assertEqual(self.errors(r), [])
        r["backend_coverage"].pop()
        self.assertIn("BE-01 through BE-25", " ".join(self.errors(r)))
        r["backend_coverage"].append({"control": "BE-25", "applicable": "yes", "status": "FAIL"})
        self.assertIn("needs a finding ID", " ".join(self.errors(r)))

    def test_secret_values_rejected(self):
        r = clean_go()
        r["evidence"][0]["observation"] = "found " + "sk-" + "ant-api03-" + "Z" * 40
        r["runbook"]["smoke_checks"] = ["curl -H 'x-vercel-protection-bypass: " + "b" * 32 + "'"]
        errs = " ".join(self.errors(r))
        self.assertIn("anthropic_api_key", errs)
        self.assertIn("bypass", errs)

    def test_renderers_escape_and_mark_private(self):
        r = clean_go()
        r["project"] = "<script>alert(1)</script>"
        page = report.render_html(r)
        self.assertNotIn("<script>alert", page)
        self.assertIn("&lt;script&gt;", page)
        self.assertIn("noindex", page)
        self.assertIn("Not an approval to deploy", page)
        self.assertNotRegex(page, r"(?:src|href)=\"https?://")
        md = report.render_md(EXAMPLE)
        self.assertIn("| F-01 | P0 | FAIL |", md)
        self.assertLess(md.index("| F-01 |"), md.index("| F-04 |"))

    def test_cli_validate_render_and_stale_warning(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "report.json"
            path.write_text(json.dumps(clean_go()))
            script = str(SHIP / "scripts" / "report.py")
            ok = subprocess.run([sys.executable, script, "validate", str(path), "--root", str(REPO)], capture_output=True, text=True)
            self.assertEqual(ok.returncode, 0, ok.stderr)
            self.assertIn("STALE", ok.stderr)
            html = subprocess.run([sys.executable, script, "render", str(path), "--format", "html"], capture_output=True, text=True)
            self.assertEqual(html.returncode, 0)
            self.assertTrue(html.stdout.startswith("<!doctype html>"))
            bad = copy.deepcopy(EXAMPLE)
            bad["verdict"] = "GO"
            path.write_text(json.dumps(bad))
            refused = subprocess.run([sys.executable, script, "render", str(path), "--format", "md"], capture_output=True, text=True)
            self.assertEqual(refused.returncode, 1)
            self.assertEqual(refused.stdout, "")

    def test_skeleton_starts_no_go_and_validates(self):
        sk = report.skeleton(REPO, "fixture")
        self.assertEqual(sk["verdict"], "NO-GO")
        self.assertEqual(self.errors(sk), [])


if __name__ == "__main__":
    unittest.main()
