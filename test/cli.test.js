const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const rootDir = join(__dirname, "..");
const cliPath = join(rootDir, "bin", "pre-ship-checklist-skill.js");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

async function runCli(args = []) {
  return execFileAsync(process.execPath, [cliPath, ...args]);
}

function tempTarget() {
  return mkdtempSync(join(tmpdir(), "pre-ship-checklist-skill-"));
}

test("prints help by default", async () => {
  const { stdout, stderr } = await runCli();

  assert.equal(stderr, "");
  assert.match(stdout, /Install Claude Code pre-ship checklist skills/);
  assert.match(stdout, /pre-ship-checklist-skill install/);
});

test("prints package version", async () => {
  const { stdout, stderr } = await runCli(["--version"]);

  assert.equal(stderr, "");
  assert.equal(stdout.trim(), packageJson.version);
});

test("lists packaged skills", async () => {
  const { stdout, stderr } = await runCli(["list"]);

  assert.equal(stderr, "");
  assert.match(stdout, /pre-launch-checklist\.skill/);
  assert.match(stdout, /vibe-coder-security-checklist\.skill/);
});

test("installs skill files into a target directory", async () => {
  const target = tempTarget();

  try {
    const { stdout, stderr } = await runCli(["install", "--target", target]);

    assert.equal(stderr, "");
    assert.match(stdout, /Installed 2 skill file/);
    assert.match(
      readFileSync(join(target, "pre-launch-checklist.skill"), "utf8"),
      /Pre-Launch Production Checklist/
    );
    assert.match(
      readFileSync(join(target, "vibe-coder-security-checklist.skill"), "utf8"),
      /Vibe Coder Pre-Ship Security Checklist/
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("does not overwrite changed files unless forced", async () => {
  const target = tempTarget();

  try {
    await runCli(["install", "--target", target]);
    writeFileSync(join(target, "pre-launch-checklist.skill"), "custom", "utf8");

    await assert.rejects(
      runCli(["install", "--target", target]),
      error => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /already exists/);
        return true;
      }
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("supports dry-run without writing files", async () => {
  const target = tempTarget();

  try {
    const { stdout, stderr } = await runCli(["install", "--target", target, "--dry-run"]);

    assert.equal(stderr, "");
    assert.match(stdout, /Would install 2 skill files/);
    assert.throws(() => readFileSync(join(target, "pre-launch-checklist.skill"), "utf8"));
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
