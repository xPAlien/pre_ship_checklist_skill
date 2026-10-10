#!/usr/bin/env python3
"""Ship read-only offline reconnaissance. Never treats discovered hints as a GO decision.

Python 3.9+. No dependencies, network calls, or project writes.
The script reports file paths and pattern names, never matched credential values.
It is not a substitute for tests, threat modeling, Git history scanning, or runtime checks.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SKIP_DIRS = {
    ".git", ".next", ".nuxt", ".turbo", ".vercel", "node_modules",
    "dist", "build", "coverage", ".venv", "venv", "vendor", ".svelte-kit",
    "__pycache__", ".cache", "target", ".output", "out",
}
CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".yaml", ".yml", ".toml", ".env", ".md", ".txt", ".sh", ".ps1", ".tf", ".ini", ".conf", ".pem", ".key"}
SECRET_PATTERNS = {
    "private_key_block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    "aws_access_key_id": re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
    "github_pat": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    "github_classic_token": re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"),
    "stripe_live_secret": re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b"),
    "slack_bot_token": re.compile(r"\bxoxb-[0-9]{8,}-[0-9]{8,}-[A-Za-z0-9]{12,}\b"),
}


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


def list_local(root, max_files=6000):
    result = []
    for directory, subdirs, filenames in os.walk(root, followlinks=False):
        subdirs[:] = [d for d in subdirs if d not in SKIP_DIRS and not (Path(directory) / d).is_symlink()]
        for name in filenames:
            full = Path(directory) / name
            if full.is_file() and not full.is_symlink():
                result.append(full.relative_to(root))
                if len(result) >= max_files:
                    return result
    return result


def has_path(paths, root, variants):
    return any((root / candidate).is_file() for candidate in variants) or any(str(path).replace("\\", "/") in variants for path in paths)


def exists_near(package_dir, paths):
    normalized = {str(p).replace("\\", "/") for p in paths}
    return any(str(package_dir / p).replace("\\", "/") in normalized for p in ("app", "src/app"))


def asset_in(root, base, filenames):
    return any((root / base / filename).is_file() for filename in filenames)


def metadata_candidates(root, folder):
    app_dirs = [root / folder / "app", root / folder / "src" / "app"]
    public_dirs = [root / folder / "public", root / "public"]
    checks = {
        "favicon": any(asset_in(root, folder / p, ["favicon.ico", "icon.png", "icon.svg", "apple-icon.png"]) for p in ("app", "src/app", "public"))
        or any(asset_in(root, Path("public"), ["favicon.ico", "icon.png", "icon.svg"]) for _ in [0]),
        "robots": any(any((d / ("robots" + ext)).is_file() for ext in (".txt", ".ts", ".js")) for d in app_dirs)
        or any((d / "robots.txt").is_file() for d in public_dirs),
        "sitemap": any(any((d / ("sitemap" + ext)).is_file() for ext in (".xml", ".ts", ".js")) for d in app_dirs)
        or any((d / "sitemap.xml").is_file() for d in public_dirs),
        "open_graph": any(any((d / file).is_file() for file in ("opengraph-image.png", "opengraph-image.jpg", "opengraph-image.tsx", "opengraph-image.ts", "opengraph-image.js")) for d in app_dirs)
        or any((d / file).is_file() for d in public_dirs for file in ("og.png", "og.jpg", "og-image.png", "og-image.jpg")),
    }
    return checks


def inspect(root):
    tracked = list_tracked(root)
    candidate_paths = tracked if tracked is not None else list_local(root)
    files = {str(p).replace("\\", "/") for p in candidate_paths}
    findings = []
    packages = []

    def note(key, level, detail, path=None):
        item = {"id": key, "level": level, "detail": detail}
        if path:
            item["path"] = str(path).replace("\\", "/")
        findings.append(item)

    sha_bytes = git(["rev-parse", "HEAD"], root)
    sha = sha_bytes.decode("utf-8", errors="replace").strip() if sha_bytes else None
    dirty_bytes = git(["status", "--porcelain=v1", "-z"], root)
    dirty_count = len([x for x in dirty_bytes.split(b"\x00") if x]) if dirty_bytes is not None else None
    if sha:
        note("G0-01", "INFO", f"Git revision captured. Working tree entries changed: {dirty_count}.")
    else:
        note("G0-01", "REVIEW", "Git revision unavailable. Record exact production candidate identity.")

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
        if "next" in deps:
            hints = metadata_candidates(root, path.parent)
            for key, found in hints.items():
                note("G5-" + ("03" if key in ("robots", "sitemap") else "04"), "INFO" if found else "REVIEW",
                     f"Next.js conventional {key.replace('_', ' ')} route or asset " + ("found. Verify rendered public behavior." if found else "not found. Check dynamic custom implementation and site applicability."), path)
        if not any(name in scripts for name in ("test", "test:unit", "test:e2e", "e2e")):
            note("G0-03", "REVIEW", "No conventional test script found in package manifest. Verify test runner and CI behavior.", path)

    dangerous_files = []
    for rel in candidate_paths:
        path_str = str(rel).replace("\\", "/")
        base = rel.name.lower()
        if tracked is not None and base.startswith(".env") and not base.endswith((".example", ".sample", ".template", ".dist")):
            dangerous_files.append(path_str)
        if not rel.suffix.lower() in CODE_EXTENSIONS and base not in (".env", "dockerfile", ".npmrc", ".pypirc"):
            continue
        full = root / rel
        try:
            if full.stat().st_size > 256_000:
                continue
            content = full.read_text(encoding="utf-8")
        except (OSError, UnicodeError, ValueError):
            continue
        for label, regex in SECRET_PATTERNS.items():
            if regex.search(content):
                note("G1-01", "REVIEW", f"High-confidence {label} pattern found in source. Inspect privately and check history. No credential contents shown.", path_str)
    if dangerous_files:
        note("G1-01", "REVIEW", f"Environment files are tracked. Review {len(dangerous_files)} file(s) privately, including template exceptions.")

    if not any(p in files for p in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "uv.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum")):
        note("G0-04", "REVIEW", "No recognized dependency lockfile in tracked files. Check language-specific dependency policy.")

    if not (root / "README.md").is_file():
        note("G0-07", "REVIEW", "Top-level README.md not found. Confirm operational documentation location.")

    if not any(p in files for p in ("vercel.json", ".vercel/project.json")):
        note("G6-01", "INFO", "Vercel not confirmed from conventional local configuration. Verify hosting externally.")
    else:
        note("G6-01", "INFO", "Vercel configuration candidate found. Confirm project and deployment protection in provider dashboard.")

    return {
        "tool": "ship-offline-preflight",
        "version": "1.0.0",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "git_sha": sha,
        "git_changed_entries": dirty_count,
        "inspected_files": len(candidate_paths),
        "scope": "Tracked files only" if tracked is not None else "Local files (Git unavailable)",
        "packages": packages,
        "findings": findings,
        "critical_limitations": [
            "This is an offline structural hint collector, not a PASS or GO verdict.",
            "Not a Git history secret scan or a complete credential detector.",
            "Does not validate authorization, UI, deployment protection, environment secrets, backups, DNS, cost controls, legal terms, or runtime behavior.",
            "No network requests or repository changes were performed.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Offline release-check hints, no production actions")
    parser.add_argument("--root", default=".", help="Project directory")
    parser.add_argument("--compact", action="store_true", help="Compact JSON output")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print("Project directory not found.", file=sys.stderr)
        return 2
    result = inspect(root)
    print(json.dumps(result, indent=None if args.compact else 2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
