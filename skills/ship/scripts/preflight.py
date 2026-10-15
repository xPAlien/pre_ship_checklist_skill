#!/usr/bin/env python3
"""Ship read-only offline reconnaissance. Never treats discovered hints as a GO decision.

Python 3.10+. No dependencies, network calls, or project writes.
The script reports file paths, line numbers, variable names, and pattern names, never matched credential values.
It is not a substitute for tests, threat modeling, Git history scanning, or runtime checks.

Exit codes: 0 completed, 1 a --fail-on condition matched, 2 invalid root.
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.1.0"
MAX_LOCAL_FILES = 6000
MAX_FILE_BYTES = 256_000
SKIP_DIRS = {
    ".git", ".next", ".nuxt", ".turbo", ".vercel", "node_modules",
    "dist", "build", "coverage", ".venv", "venv", "vendor", ".svelte-kit",
    "__pycache__", ".cache", "target", ".output", "out",
}
CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".yaml", ".yml", ".toml", ".env", ".md", ".txt", ".sh", ".ps1", ".tf", ".ini", ".conf", ".pem", ".key", ".vue", ".svelte", ".astro", ".rb", ".go", ".php"}
SCANNED_NAMES = {".env", "dockerfile", ".npmrc", ".pypirc"}
ENV_TEMPLATE_SUFFIXES = (".example", ".sample", ".template", ".dist")
SECRET_PATTERNS = {
    "private_key_block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED |DSA )?PRIVATE KEY-----"),
    "aws_access_key_id": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "github_pat": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    "github_classic_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "stripe_live_secret": re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b"),
    "stripe_live_restricted": re.compile(r"\brk_live_[A-Za-z0-9]{16,}\b"),
    "stripe_webhook_secret": re.compile(r"\bwhsec_[A-Za-z0-9]{24,}\b"),
    "slack_bot_token": re.compile(r"\bxoxb-[0-9]{8,}-[0-9]{8,}-[A-Za-z0-9]{12,}\b"),
    "anthropic_api_key": re.compile(r"\bsk-ant-[a-z]{3,6}\d{2}-[A-Za-z0-9_-]{20,}"),
    "openai_project_key": re.compile(r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}"),
    "openai_legacy_key": re.compile(r"\bsk-[A-Za-z0-9]{48}\b"),
    "google_api_key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "supabase_secret_key": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}"),
    "vercel_token_assignment": re.compile(r"\bVERCEL_(?:TOKEN|API_TOKEN)\s*[=:]\s*['\"]?[A-Za-z0-9]{24,}"),
    "resend_key_assignment": re.compile(r"\bRESEND_API_KEY\s*[=:]\s*['\"]?re_[A-Za-z0-9_]{16,}"),
}
PATTERN_NOTES = {
    "google_api_key": " Firebase web keys are public by design. Verify API and referrer restrictions.",
}
JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}")
PUBLIC_PREFIX = re.compile(
    r"\b((?:NEXT_PUBLIC|VITE|PUBLIC|EXPO_PUBLIC|NUXT_PUBLIC|REACT_APP|GATSBY)_[A-Z0-9_]*"
    r"(?:SECRET|SERVICE_ROLE|SERVICE_KEY|PRIVATE|PASSWORD|OPENAI|ANTHROPIC|STRIPE_SECRET|DATABASE_URL|DB_URL)[A-Z0-9_]*)\b"
)
VERCEL_DEPENDENCIES = ("vercel", "@vercel/analytics", "@vercel/speed-insights", "@vercel/blob", "@vercel/kv", "@vercel/postgres", "@vercel/edge-config", "@vercel/functions", "@vercel/flags", "@vercel/og")


def git(args, root):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=8,
            check=False,
        )
        return result.stdout if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def list_tracked(root):
    data = git(["ls-files", "-z", "--cached"], root)
    if data is None:
        return None
    paths = []
    for raw in data.split(b"\x00"):
        if not raw:
            continue
        rel = Path(os.fsdecode(raw))
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        full = root / rel
        if full.is_file() and not full.is_symlink():
            paths.append(rel)
    return paths


def list_local(root, max_files=MAX_LOCAL_FILES):
    """Return (paths, truncated)."""
    result = []
    for directory, subdirs, filenames in os.walk(root, followlinks=False):
        subdirs[:] = [d for d in subdirs if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink()]
        for name in filenames:
            full = Path(directory) / name
            if full.is_file() and not full.is_symlink():
                result.append(full.relative_to(root))
                if len(result) >= max_files:
                    return result, True
    return result, False


def norm(path):
    return str(path).replace("\\", "/")


def read_text(path):
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            return None
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError, ValueError):
        return None


def line_numbers(content, regex):
    lines = []
    for match in regex.finditer(content):
        lines.append(content.count("\n", 0, match.start()) + 1)
    return sorted(set(lines))


def is_env_file(name):
    return name.startswith(".env")


def is_env_template(name):
    return name.endswith(ENV_TEMPLATE_SUFFIXES)


def jwt_service_role_lines(content):
    lines = []
    for match in JWT.finditer(content):
        segment = match.group(1)
        try:
            payload = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
        except (ValueError, UnicodeError):
            continue
        if isinstance(payload, dict) and payload.get("role") == "service_role":
            lines.append(content.count("\n", 0, match.start()) + 1)
    return sorted(set(lines))


def asset_in(folder, filenames):
    return any((folder / filename).is_file() for filename in filenames)


def metadata_candidates(root, folder):
    app_dirs = [root / folder / "app", root / folder / "src" / "app"]
    public_dirs = [root / folder / "public", root / "public"]
    return {
        "favicon": any(asset_in(d, ["favicon.ico", "icon.png", "icon.svg", "apple-icon.png", "icon.tsx", "icon.ts"]) for d in app_dirs + public_dirs),
        "robots": any(asset_in(d, ["robots.txt", "robots.ts", "robots.js"]) for d in app_dirs) or any((d / "robots.txt").is_file() for d in public_dirs),
        "sitemap": any(asset_in(d, ["sitemap.xml", "sitemap.ts", "sitemap.js"]) for d in app_dirs) or any((d / "sitemap.xml").is_file() for d in public_dirs),
        "open_graph": any(asset_in(d, ["opengraph-image.png", "opengraph-image.jpg", "opengraph-image.tsx", "opengraph-image.ts", "opengraph-image.js"]) for d in app_dirs)
        or any(asset_in(d, ["og.png", "og.jpg", "og-image.png", "og-image.jpg"]) for d in public_dirs),
    }


def cron_route_candidates(base, cron_path):
    """Map a vercel.json cron path to likely route handler files."""
    clean = cron_path.split("?")[0].strip("/")
    if not clean:
        return []
    candidates = []
    for app in ("app", "src/app"):
        for ext in ("ts", "js", "mjs", "tsx"):
            candidates.append(base / app / clean / f"route.{ext}")
    for pages in ("pages", "src/pages"):
        for ext in ("ts", "js", "mjs"):
            candidates.append(base / pages / f"{clean}.{ext}")
            candidates.append(base / pages / clean / f"index.{ext}")
    for ext in ("ts", "js", "mjs", "py", "go"):
        candidates.append(base / f"{clean}.{ext}")
    return candidates


def inspect(root):
    tracked = list_tracked(root)
    truncated = False
    if tracked is not None:
        candidate_paths = tracked
    else:
        candidate_paths, truncated = list_local(root)
    files = {norm(p) for p in candidate_paths}
    findings = []
    packages = []
    vercel_signals = []

    def note(key, level, detail, path=None, lines=None, kind=None):
        item = {"id": key, "level": level, "detail": detail}
        if path:
            item["path"] = norm(path)
        if lines:
            item["lines"] = lines
        if kind:
            item["kind"] = kind
        findings.append(item)

    sha_bytes = git(["rev-parse", "HEAD"], root)
    sha = sha_bytes.decode("utf-8", errors="replace").strip() if sha_bytes else None
    dirty_bytes = git(["status", "--porcelain=v1", "-z"], root)
    dirty_count = len([x for x in dirty_bytes.split(b"\x00") if x]) if dirty_bytes is not None else None
    if sha:
        note("G0-01", "INFO", f"Git revision captured. Working tree entries changed: {dirty_count}.")
    else:
        note("G0-01", "REVIEW", "Git revision unavailable. Record exact production candidate identity.")
    if truncated:
        note("G0-01", "REVIEW", f"Local scan stopped at {MAX_LOCAL_FILES} files. Results are partial. Run inside a Git checkout for a tracked-file scan.", kind="scan_truncated")

    ci = any(p.startswith(".github/workflows/") or p.startswith(".gitlab/") for p in files) or any(
        (root / p).is_file() for p in ("bitbucket-pipelines.yml", ".gitlab-ci.yml", "azure-pipelines.yml")
    )
    note("G0-03", "INFO" if ci else "REVIEW", "CI configuration candidate found." if ci else "No recognized CI configuration discovered. Verify pipeline outside the repository.")

    manifest_paths = sorted(p for p in files if p == "package.json" or p.endswith("/package.json"))[:80]
    for path_str in manifest_paths:
        path = Path(path_str)
        try:
            manifest = json.loads((root / path).read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            note("G0-04", "REVIEW", "Package manifest unreadable.", path)
            continue
        deps = {}
        deps.update(manifest.get("dependencies") or {})
        deps.update(manifest.get("devDependencies") or {})
        scripts = manifest.get("scripts") or {}
        framework = [name for name in ("next", "react", "vite", "svelte", "@sveltejs/kit", "nuxt", "astro", "hono", "express", "fastify") if name in deps]
        packages.append({
            "path": path_str,
            "framework_candidates": framework,
            "available_scripts": [x for x in ("build", "test", "lint", "typecheck", "check", "e2e", "test:e2e") if x in scripts],
        })
        vercel_deps = [name for name in VERCEL_DEPENDENCIES if name in deps]
        if vercel_deps:
            vercel_signals.append(f"{path_str} depends on {', '.join(vercel_deps)}")
        if any(re.search(r"(^|\s)vercel(\s|$)", str(command)) for command in scripts.values()):
            vercel_signals.append(f"{path_str} scripts invoke the Vercel CLI")
        if "next" in deps:
            hints = metadata_candidates(root, path.parent)
            for key, found in hints.items():
                note("G5-" + ("03" if key in ("robots", "sitemap") else "04"), "INFO" if found else "REVIEW",
                     f"Next.js conventional {key.replace('_', ' ')} route or asset " + ("found. Verify rendered public behavior." if found else "not found. Check dynamic custom implementation and site applicability."), path)
        if not any(name in scripts for name in ("test", "test:unit", "test:e2e", "e2e")):
            note("G0-03", "REVIEW", "No conventional test script found in package manifest. Verify test runner and CI behavior.", path)

    dangerous_files = []
    for rel in candidate_paths:
        path_str = norm(rel)
        base = rel.name.lower()
        env_file = is_env_file(base)
        if tracked is not None and env_file and not is_env_template(base):
            dangerous_files.append(path_str)
        if rel.suffix.lower() not in CODE_EXTENSIONS and base not in SCANNED_NAMES and not env_file:
            continue
        content = read_text(root / rel)
        if content is None:
            continue
        # An untracked local env file is expected to hold secrets. Tracked or source files are not.
        check_values = tracked is not None or not env_file
        if check_values:
            for label, regex in SECRET_PATTERNS.items():
                lines = line_numbers(content, regex)
                if lines:
                    note("G1-01", "REVIEW", f"High-confidence {label} pattern found. Inspect privately and check history. No credential contents shown.{PATTERN_NOTES.get(label, '')}", path_str, lines, "secret")
            jwt_lines = jwt_service_role_lines(content)
            if jwt_lines:
                note("G1-01", "REVIEW", "JWT with role service_role found. A Supabase service-role key bypasses row-level security. Inspect privately and check history.", path_str, jwt_lines, "secret")
        public_names = sorted({m.group(1) for m in PUBLIC_PREFIX.finditer(content)})
        if public_names:
            note("G1-01", "REVIEW", "Client-exposed variable name suggests a private credential. Public prefixes are inlined into browser bundles: " + ", ".join(public_names) + ".", path_str, line_numbers(content, PUBLIC_PREFIX), "public_secret_name")
    if dangerous_files:
        note("G1-01", "REVIEW", f"Environment files are tracked. Review {len(dangerous_files)} file(s) privately, including template exceptions.", kind="tracked_env")

    # Untracked local env files never reach Git, but public-prefixed names still reach the browser bundle.
    if tracked is not None:
        seen = set(files)
        for folder in {root} | {root / Path(p["path"]).parent for p in packages}:
            try:
                entries = list(folder.iterdir())
            except OSError:
                continue
            for entry in entries:
                rel = norm(entry.relative_to(root))
                if rel in seen or not entry.is_file() or not is_env_file(entry.name.lower()) or is_env_template(entry.name.lower()):
                    continue
                content = read_text(entry)
                if content is None:
                    continue
                names = sorted({m.group(1) for m in PUBLIC_PREFIX.finditer(content)})
                if names:
                    note("G1-01", "REVIEW", "Local env file defines client-exposed names suggesting a private credential: " + ", ".join(names) + ". Check the same names in provider environment settings.", rel, line_numbers(content, PUBLIC_PREFIX), "public_secret_name")

    if not any(p in files for p in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "uv.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum")):
        note("G0-04", "REVIEW", "No recognized dependency lockfile in tracked files. Check language-specific dependency policy.")

    if not (root / "README.md").is_file():
        note("G0-07", "REVIEW", "Top-level README.md not found. Confirm operational documentation location.")

    vercel_configs = sorted(p for p in files if p.split("/")[-1] in ("vercel.json", "vercel.ts"))
    if vercel_configs:
        vercel_signals.append("config: " + ", ".join(vercel_configs))
    if (root / ".vercel" / "project.json").is_file():
        vercel_signals.append("local .vercel/project.json link")
    if any(p.startswith(".github/workflows/") and "vercel" in (read_text(root / p) or "").lower() for p in files):
        vercel_signals.append("CI workflow references Vercel")
    if vercel_signals:
        note("G6-01", "INFO", "Vercel hosting candidate: " + "; ".join(vercel_signals) + ". Confirm project, production branch, and deployment protection with the provider.", kind="vercel_detected")
    else:
        note("G6-01", "INFO", "Vercel not detected from config, dependencies, scripts, link, or CI. Verify hosting externally.")

    for config in (p for p in vercel_configs if p.endswith(".json")):
        try:
            data = json.loads((root / config).read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            note("G6-09", "REVIEW", "vercel.json unreadable. Verify cron and function configuration manually.", config)
            continue
        crons = data.get("crons") if isinstance(data, dict) else None
        if not isinstance(crons, list):
            continue
        base = root / Path(config).parent
        for cron in crons:
            cron_path = cron.get("path") if isinstance(cron, dict) else None
            if not isinstance(cron_path, str):
                continue
            handlers = [c for c in cron_route_candidates(base, cron_path) if c.is_file()]
            if not handlers:
                note("G6-12", "REVIEW", f"Cron path {cron_path} has no conventional handler file. Verify the handler checks CRON_SECRET.", config, kind="cron_auth")
                continue
            for handler in handlers:
                text = read_text(handler) or ""
                rel = norm(handler.relative_to(root))
                if "CRON_SECRET" in text:
                    note("G6-12", "INFO", f"Cron handler for {cron_path} references CRON_SECRET. Verify a missing or wrong header returns 401.", rel, kind="cron_auth")
                else:
                    note("G6-12", "REVIEW", f"Cron handler for {cron_path} does not reference CRON_SECRET. Vercel cron paths are public URLs. Anyone can trigger this job.", rel, kind="cron_auth")

    return {
        "tool": "ship-offline-preflight",
        "version": VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "git_sha": sha,
        "git_changed_entries": dirty_count,
        "inspected_files": len(candidate_paths),
        "scope": "Tracked files only" if tracked is not None else "Local files (Git unavailable)",
        "truncated": truncated,
        "packages": packages,
        "findings": findings,
        "critical_limitations": [
            "This is an offline structural hint collector, not a PASS or GO verdict.",
            "Not a Git history secret scan or a complete credential detector.",
            "Does not validate authorization, UI, deployment protection, environment secrets, backups, DNS, cost controls, legal terms, or runtime behavior.",
            "No network requests or repository changes were performed.",
        ],
    }


def render_text(result, kinds=None):
    lines = [f"ship preflight {result['version']} | {result['scope']} | {result['inspected_files']} files | sha {result['git_sha'] or 'unknown'}"]
    for f in result["findings"]:
        if kinds and f.get("kind") not in kinds:
            continue
        where = f.get("path", "")
        if f.get("lines"):
            where += ":" + ",".join(str(n) for n in f["lines"][:10])
        lines.append(f"{f['level']:6} {f['id']:6} {where} {f['detail']}".rstrip())
    lines.append("Hints only. Not a PASS or GO verdict.")
    return "\n".join(lines)


def should_fail(result, fail_on):
    if fail_on == "none":
        return False
    if fail_on == "secret":
        return any(f.get("kind") in ("secret", "public_secret_name", "tracked_env") for f in result["findings"])
    return any(f["level"] == "REVIEW" for f in result["findings"])


def main():
    parser = argparse.ArgumentParser(description="Offline release-check hints, no production actions")
    parser.add_argument("--root", default=".", help="Project directory")
    parser.add_argument("--compact", action="store_true", help="Compact JSON output")
    parser.add_argument("--fail-on", choices=("none", "secret", "review"), default="none",
                        help="Exit 1 when secret-like findings (secret) or any REVIEW finding (review) exist")
    parser.add_argument("--format", choices=("json", "text"), default="json", help="JSON for agents, text for terminals and Git hooks")
    parser.add_argument("--only-kinds", help="Comma-separated finding kinds to print in text format, for example secret,public_secret_name")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print("Project directory not found.", file=sys.stderr)
        return 2
    result = inspect(root)
    result["fail_on"] = args.fail_on
    failed = should_fail(result, args.fail_on)
    result["fail_on_matched"] = failed
    if args.format == "text":
        print(render_text(result, args.only_kinds.split(",") if args.only_kinds else None))
    else:
        print(json.dumps(result, indent=None if args.compact else 2, sort_keys=True))
    if failed:
        print(f"preflight: --fail-on {args.fail_on} matched. Review the findings above.", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
