#!/usr/bin/env node

const { copyFileSync, existsSync, mkdirSync, readFileSync } = require("node:fs");
const { basename, join, resolve } = require("node:path");
const { homedir } = require("node:os");

const ROOT_DIR = join(__dirname, "..");
const SKILL_FILES = [
  "pre-launch-checklist.skill",
  "vibe-coder-security-checklist.skill"
];

function defaultSkillsDir() {
  if (process.env.CLAUDE_SKILLS_DIR) {
    return resolve(process.env.CLAUDE_SKILLS_DIR);
  }

  return join(homedir(), ".claude", "skills");
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8"));
  return packageJson.version;
}

function printHelp() {
  console.log(`pre-ship-checklist-skill

Install Claude Code pre-ship checklist skills.

Usage:
  pre-ship-checklist-skill install [options]
  pre-ship-checklist-skill list
  pre-ship-checklist-skill doctor [options]

Options:
  --target <dir>  Install skills into a specific directory
  --force         Overwrite existing skill files
  --dry-run       Show what would be installed without writing files
  --help, -h      Show this help message
  --version, -v   Print the package version

Environment:
  CLAUDE_SKILLS_DIR  Overrides the default target directory

Default target:
  ${defaultSkillsDir()}`);
}

function parseOptions(args) {
  const options = {
    command: args[0] || "help",
    target: defaultSkillsDir(),
    force: false,
    dryRun: false
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--target") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--target requires a directory");
      }
      options.target = resolve(value);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function listSkills() {
  for (const file of SKILL_FILES) {
    console.log(file);
  }
}

function getInstallPlan(target) {
  return SKILL_FILES.map(file => ({
    source: join(ROOT_DIR, file),
    destination: join(target, basename(file))
  }));
}

function installSkills(options) {
  const plan = getInstallPlan(options.target);

  if (options.dryRun) {
    console.log(`Would install ${plan.length} skill files to ${options.target}`);
    for (const item of plan) {
      console.log(`- ${basename(item.source)} -> ${item.destination}`);
    }
    return 0;
  }

  mkdirSync(options.target, { recursive: true });

  const copied = [];
  const skipped = [];

  for (const item of plan) {
    if (!existsSync(item.source)) {
      throw new Error(`Missing packaged skill file: ${basename(item.source)}`);
    }

    if (existsSync(item.destination) && !options.force) {
      const sourceContent = readFileSync(item.source, "utf8");
      const destinationContent = readFileSync(item.destination, "utf8");

      if (sourceContent !== destinationContent) {
        throw new Error(`${basename(item.destination)} already exists. Re-run with --force to overwrite it.`);
      }

      skipped.push(item.destination);
      continue;
    }

    copyFileSync(item.source, item.destination);
    copied.push(item.destination);
  }

  console.log(`Installed ${copied.length} skill file(s) to ${options.target}`);

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} unchanged existing file(s).`);
  }

  return 0;
}

function doctor(options) {
  console.log(`Package version: ${readPackageVersion()}`);
  console.log(`Target directory: ${options.target}`);
  console.log("Packaged skills:");
  for (const item of getInstallPlan(options.target)) {
    const status = existsSync(item.source) ? "found" : "missing";
    console.log(`- ${basename(item.source)}: ${status}`);
  }
}

function main(args) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    printHelp();
    return 0;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(readPackageVersion());
    return 0;
  }

  const options = parseOptions(args);

  if (options.command === "install") {
    return installSkills(options);
  }

  if (options.command === "list") {
    listSkills();
    return 0;
  }

  if (options.command === "doctor") {
    doctor(options);
    return 0;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
