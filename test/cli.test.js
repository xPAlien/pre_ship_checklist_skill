"use strict";
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const rootDir = join(__dirname, "..");
const cli = join(rootDir, "bin", "pre-ship-checklist-skill.js");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

function tempTarget() { return mkdtempSync(join(tmpdir(), "pre-ship-skill-")); }
async function run(args = [], cwd = rootDir) {
  return execFileAsync(process.execPath, [cli, ...args], { cwd });
}

const samples = {
  "ship/SKILL.md": /name: ship/,
  "ship/references/checklist.md": /G0/,
  "ship/references/backend-controls.md": /BE-25/,
  "ship/references/backend-review.md": /one designated writer/,
  "ship/scripts/preflight.py": /preflight|def main/,
  "pre-launch-checklist/SKILL.md": /Pre-Launch Production Checklist/,
  "vibe-coder-security-checklist/SKILL.md": /Vibe Coder Pre-Ship Security Checklist/
};

test("help and version", async () => {
  const { stdout, stderr } = await run();
  assert.equal(stderr, "");
  assert.match(stdout, /Install and inspect three production-readiness skills/);
  assert.match(stdout, /codex/);
  const v = await run(["--version"]);
  assert.equal(v.stdout.trim(), packageJson.version);
});

test("list includes all three independent skills", async () => {
  const { stdout } = await run(["list"]);
  assert.deepEqual(stdout.trim().split("\n"), ["ship", "pre-launch-checklist", "vibe-coder-security-checklist"]);
});

test("target list includes Codex, Claude, and legacy agents", async () => {
  const { stdout } = await run(["targets"]);
  for (const name of ["codex", "claude", "openclaw", "hermes", "pi", "goose", "agents"]) {
    assert.match(stdout, new RegExp(`${name}:`));
  }
});

for (const agent of ["claude", "codex", "openclaw", "hermes", "pi", "agents"]) {
  test(`installs all folder-based packages for ${agent}`, async () => {
    const target = tempTarget();
    try {
      const { stdout, stderr } = await run(["install", "--agent", agent, "--target", target]);
      assert.equal(stderr, "");
      assert.match(stdout, /Installed \d+ managed file/);
      for (const [path, pattern] of Object.entries(samples)) {
        assert.match(readFileSync(join(target, path), "utf8"), pattern);
      }
    } finally { rmSync(target, { recursive: true, force: true }); }
  });
}

test("default Claude install is folder-based, not flat files", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--target", target]);
    assert.equal(existsSync(join(target, "pre-launch-checklist.skill")), false);
    assert.equal(existsSync(join(target, "pre-launch-checklist", "SKILL.md")), true);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("--only ship includes every reference and helper", async () => {
  const target = tempTarget();
  try {
    const { stdout } = await run(["install", "--only", "ship", "--target", target]);
    assert.match(stdout, /Installed \d+ managed file/);
    for (const path of ["SKILL.md", "README.md", "references/source-mapping.md", "references/vercel.md", "references/backend-controls.md", "references/backend-review.md", "references/hooks.md", "references/report-artifact.md", "templates/ship-report.md", "templates/ship-report.schema.json", "templates/ship-report.example.json", "scripts/report.py", "hooks/deploy-guard.cjs", "hooks/post-deploy.cjs", "hooks/ship-hooks-lib.cjs", "hooks/git-pre-push.sh"]) {
      assert.equal(existsSync(join(target, "ship", path)), true, path);
    }
    assert.equal(existsSync(join(target, "ship", "tests")), false, "regression tests stay out of installed skills");
    assert.equal(existsSync(join(target, "pre-launch-checklist")), false);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("--only accepts a comma-separated list", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--only", "ship,vibe-coder-security-checklist", "--target", target]);
    assert.equal(existsSync(join(target, "ship", "SKILL.md")), true);
    assert.equal(existsSync(join(target, "vibe-coder-security-checklist", "SKILL.md")), true);
    assert.equal(existsSync(join(target, "pre-launch-checklist")), false);
    await assert.rejects(run(["install", "--only", "ship,unknown", "--target", target]), e => e.code === 1 && /Unknown skill: unknown/.test(e.stderr));
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("--scope project respects working directory", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--agent", "codex", "--scope", "project", "--only", "ship"], target);
    assert.equal(existsSync(join(target, ".agents", "skills", "ship", "SKILL.md")), true);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("install is idempotent and doctor detects intact installation", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--target", target]);
    const { stdout } = await run(["install", "--target", target]);
    assert.match(stdout, /Installed 0 managed file/);
    const doc = await run(["doctor", "--target", target]);
    assert.match(doc.stdout, /ship\/SKILL.md: installed|ship\\SKILL.md: installed/);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("changed existing files block all writes without --force", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--target", target]);
    writeFileSync(join(target, "ship", "SKILL.md"), "locally modified\n");
    writeFileSync(join(target, "pre-launch-checklist", "SKILL.md"), "second modification\n");
    await assert.rejects(run(["install", "--target", target]), error => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /No files were written/);
      return true;
    });
    assert.equal(readFileSync(join(target, "ship", "SKILL.md"), "utf8"), "locally modified\n");
    assert.equal(readFileSync(join(target, "pre-launch-checklist", "SKILL.md"), "utf8"), "second modification\n");
    const doctor = await assert.rejects(run(["doctor", "--target", target]), e => e.code === 1);
    assert.equal(doctor, undefined);
    await run(["install", "--target", target, "--force"]);
    assert.match(readFileSync(join(target, "ship", "SKILL.md"), "utf8"), /Production Release Gate/);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("installer never removes unrelated user files", async () => {
  const target = tempTarget();
  try {
    await run(["install", "--target", target]);
    const custom = join(target, "ship", "CUSTOM.md");
    writeFileSync(custom, "keep me");
    await run(["install", "--target", target, "--force"]);
    assert.equal(readFileSync(custom, "utf8"), "keep me");
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("dry run changes no files", async () => {
  const target = tempTarget();
  try {
    const { stdout } = await run(["install", "--target", target, "--dry-run"]);
    assert.match(stdout, /Would install \d+ managed file/);
    assert.equal(existsSync(join(target, "ship")), false);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("goose hints use one managed block and preserve other lines", async () => {
  const target = tempTarget();
  const file = join(target, ".goosehints");
  try {
    writeFileSync(file, "Custom user settings\n");
    await run(["install", "--agent", "goose", "--target", file]);
    await run(["install", "--agent", "goose", "--target", file]);
    const contents = readFileSync(file, "utf8");
    assert.match(contents, /Custom user settings/);
    assert.match(contents, /GO, CONDITIONAL GO, or NO-GO/);
    assert.equal(contents.match(/# pre-ship-checklist-skill:start/g).length, 1);
    assert.equal(contents.match(/# pre-ship-checklist-skill:end/g).length, 1);
  } finally { rmSync(target, { recursive: true, force: true }); }
});

test("rejects bad agent, skill and scope", async () => {
  for (const args of [
    ["install", "--agent", "mystery"],
    ["install", "--only", "unknown"],
    ["install", "--scope", "staging"],
    ["install", "--agent"],
    ["install", "--git"],
    ["install", "--write-settings"]
  ]) {
    await assert.rejects(run(args), error => error.code === 1);
  }
});
