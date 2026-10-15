"""Offline regression checks for the Ship structural helper."""
import base64
import json
import subprocess
import sys
import tempfile
import unittest
sys.dont_write_bytecode = True
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "skills" / "ship" / "scripts" / "preflight.py"

# Credential-shaped fixtures are assembled at runtime so this file never matches a scanner itself.
ANTHROPIC = "sk-" + "ant-api03-" + "Q" * 60
OPENAI = "sk-" + "proj-" + "R" * 48
EXPOSED_NAME = "NEXT" + "_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"


def service_role_jwt():
    enc = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return enc({"alg": "HS256", "typ": "JWT"}) + "." + enc({"role": "service_role", "iss": "supabase"}) + "." + "s" * 43


def git(root, *args):
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True)


class PreflightTests(unittest.TestCase):
    def run_script(self, root, *extra, check=True):
        p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(root), *extra], capture_output=True, text=True, check=check)
        return p if not check else json.loads(p.stdout)

    def git_root(self, folder):
        root = Path(folder)
        if git(root, "init", "-q").returncode != 0:
            self.skipTest("Git unavailable")
        return root

    def test_missing_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(Path(folder) / "absent")], capture_output=True, text=True)
            self.assertEqual(p.returncode, 2)

    def test_next_metadata_hints_and_no_go_claim(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "package.json").write_text(json.dumps({"dependencies": {"next": "1.0.0"}, "scripts": {"build": "next build", "test": "echo mock"}}))
            (root / "README.md").write_text("Synthetic test")
            (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'")
            (root / "app").mkdir()
            (root / "app" / "robots.ts").write_text("export default function robots() { return {} }")
            (root / "app" / "icon.svg").write_text("<svg/>")
            result = self.run_script(root)
            self.assertEqual(result["tool"], "ship-offline-preflight")
            self.assertTrue(result["critical_limitations"])
            self.assertTrue(any("robots" in x["detail"] and x["level"] == "INFO" for x in result["findings"]))
            self.assertTrue(any("favicon" in x["detail"] and x["level"] == "INFO" for x in result["findings"]))
            self.assertTrue(any("sitemap" in x["detail"] and x["level"] == "REVIEW" for x in result["findings"]))
            self.assertFalse({"verdict", "decision", "GO", "status"} & set(result))
            for finding in result["findings"]:
                self.assertIn(finding["level"], ("INFO", "REVIEW"))
                self.assertNotRegex(finding["detail"], r"\b(?:GO|NO-GO|PASS)\b")

    def test_redacted_token_patterns_with_lines(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            token = "ghp_" + "A" * 36
            (root / "application.py").write_text("import os\nTOKEN='" + token + "'\n")
            (root / "route.ts").write_text("const a = 1\nconst k = '" + ANTHROPIC + "'\nconst o = '" + OPENAI + "'\n")
            result = self.run_script(root)
            rendered = json.dumps(result)
            for value in (token, ANTHROPIC, OPENAI):
                self.assertNotIn(value, rendered)
            by_label = {x["detail"].split(" pattern")[0].split()[-1]: x for x in result["findings"] if x.get("kind") == "secret"}
            self.assertEqual(by_label["github_classic_token"]["lines"], [2])
            self.assertEqual(by_label["anthropic_api_key"]["lines"], [2])
            self.assertEqual(by_label["openai_project_key"]["lines"], [3])

    def test_service_role_jwt_detected_without_value(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            jwt = service_role_jwt()
            (root / "client.ts").write_text("export const key = '" + jwt + "'\n")
            result = self.run_script(root)
            self.assertTrue(any("service_role" in x["detail"] for x in result["findings"]))
            self.assertNotIn(jwt, json.dumps(result))

    def test_public_prefix_secret_name_in_source_and_untracked_env(self):
        with tempfile.TemporaryDirectory() as folder:
            root = self.git_root(folder)
            (root / "lib.ts").write_text("const url = process.env.NEXT_PUBLIC_SITE_URL\nconst key = process.env." + EXPOSED_NAME + "\n")
            (root / ".env.local").write_text(EXPOSED_NAME + "=synthetic\nSAFE=1\n")
            git(root, "add", "lib.ts")
            result = self.run_script(root)
            hits = [x for x in result["findings"] if x.get("kind") == "public_secret_name"]
            self.assertEqual({x["path"] for x in hits}, {"lib.ts", ".env.local"})
            self.assertTrue(all(EXPOSED_NAME in x["detail"] for x in hits))
            self.assertNotIn("NEXT_PUBLIC_SITE_URL", json.dumps(hits))
            self.assertNotIn("synthetic", json.dumps(result))

    def test_untracked_local_env_values_are_expected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = self.git_root(folder)
            (root / ".env.local").write_text("ANTHROPIC_API_KEY=" + ANTHROPIC + "\n")
            (root / "README.md").write_text("x")
            git(root, "add", "README.md")
            result = self.run_script(root)
            self.assertFalse(any(x.get("kind") == "secret" for x in result["findings"]))

    def test_tracked_environment_file_alert(self):
        with tempfile.TemporaryDirectory() as folder:
            root = self.git_root(folder)
            (root / ".env").write_text("USER_VALUE=synthetic")
            (root / ".env.example").write_text("USER_VALUE=placeholder")
            git(root, "add", ".env", ".env.example")
            result = self.run_script(root)
            self.assertTrue(any("Environment files are tracked" in x["detail"] for x in result["findings"]))
            self.assertEqual(result["scope"], "Tracked files only")

    def test_fail_on_exit_codes_and_text_format(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "README.md").write_text("x")
            clean = self.run_script(root, "--fail-on", "secret", check=False)
            self.assertEqual(clean.returncode, 0)
            (root / "k.ts").write_text("const k = '" + ANTHROPIC + "'\n")
            dirty = self.run_script(root, "--fail-on", "secret", "--format", "text", check=False)
            self.assertEqual(dirty.returncode, 1)
            self.assertIn("k.ts:1", dirty.stdout)
            self.assertIn("Not a PASS or GO verdict", dirty.stdout)
            self.assertNotIn(ANTHROPIC, dirty.stdout + dirty.stderr)
            review = self.run_script(root, "--fail-on", "review", check=False)
            self.assertEqual(review.returncode, 1)

    def test_vercel_detection_without_vercel_json(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "package.json").write_text(json.dumps({"dependencies": {"@vercel/analytics": "1.0.0"}, "scripts": {"deploy": "vercel deploy"}}))
            result = self.run_script(root)
            hit = [x for x in result["findings"] if x.get("kind") == "vercel_detected"]
            self.assertEqual(len(hit), 1)
            self.assertIn("@vercel/analytics", hit[0]["detail"])

    def test_cron_handler_without_cron_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "vercel.json").write_text(json.dumps({"crons": [{"path": "/api/cron/open", "schedule": "0 5 * * *"}, {"path": "/api/cron/safe", "schedule": "0 6 * * *"}, {"path": "/api/cron/missing", "schedule": "0 7 * * *"}]}))
            for name, body in (("open", "export function GET() { return Response.json({}) }"), ("safe", "if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response(null, { status: 401 })")):
                folder_path = root / "app" / "api" / "cron" / name
                folder_path.mkdir(parents=True)
                (folder_path / "route.ts").write_text(body)
            result = self.run_script(root)
            cron = {x.get("path"): x for x in result["findings"] if x.get("kind") == "cron_auth"}
            self.assertEqual(cron["app/api/cron/open/route.ts"]["level"], "REVIEW")
            self.assertEqual(cron["app/api/cron/safe/route.ts"]["level"], "INFO")
            self.assertEqual(cron["vercel.json"]["level"], "REVIEW")
            self.assertEqual(cron["vercel.json"]["id"], "G6-12")

    def test_local_scan_reports_truncation(self):
        sys.path.insert(0, str(SCRIPT.parent))
        import preflight
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for i in range(5):
                (root / f"f{i}.txt").write_text("x")
            paths, truncated = preflight.list_local(root, max_files=3)
            self.assertEqual(len(paths), 3)
            self.assertTrue(truncated)

    def test_repository_self_scan_is_clean(self):
        p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(REPO), "--fail-on", "secret", "--format", "text"], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout)


if __name__ == "__main__":
    unittest.main()
