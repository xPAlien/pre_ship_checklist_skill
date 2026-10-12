"""Offline regression checks for the Ship structural helper."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "preflight.py"


class PreflightTests(unittest.TestCase):
    def run_script(self, root):
        p = subprocess.run([sys.executable, str(SCRIPT), "--root", str(root)], capture_output=True, text=True, check=True)
        return json.loads(p.stdout)

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
            result = self.run_script(root)
            self.assertEqual(result["tool"], "ship-offline-preflight")
            self.assertTrue(result["critical_limitations"])
            self.assertTrue(any("robots" in x["detail"] for x in result["findings"]))
            self.assertTrue(any("sitemap" in x["detail"] and x["level"] == "REVIEW" for x in result["findings"]))
            self.assertNotIn("GO", result)

    def test_redacted_private_key_pattern(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            token = "ghp_" + "A" * 36
            (root / "application.py").write_text("TOKEN='" + token + "'")
            result = self.run_script(root)
            rendered = json.dumps(result)
            self.assertTrue(any("github_classic_token" in x["detail"] for x in result["findings"]))
            self.assertNotIn(token, rendered)

    def test_tracked_environment_file_alert(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            init = subprocess.run(["git", "-C", str(root), "init", "-q"], capture_output=True)
            if init.returncode != 0:
                self.skipTest("Git unavailable")
            (root / ".env").write_text("USER_VALUE=synthetic")
            (root / ".env.example").write_text("USER_VALUE=placeholder")
            subprocess.run(["git", "-C", str(root), "add", ".env", ".env.example"], check=True, capture_output=True)
            result = self.run_script(root)
            self.assertTrue(any("Environment files are tracked" in x["detail"] for x in result["findings"]))
            self.assertEqual(result["scope"], "Tracked files only")


if __name__ == "__main__":
    unittest.main()
