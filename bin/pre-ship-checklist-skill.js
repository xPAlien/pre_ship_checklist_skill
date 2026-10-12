#!/usr/bin/env node
"use strict";

const {
  copyFileSync,
  existsSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} = require("node:fs");
const { basename, dirname, join, relative, resolve } = require("node:path");
const { homedir, platform } = require("node:os");

const ROOT = join(__dirname, "..");
const SPECIALISTS = ["pre-launch-checklist", "vibe-coder-security-checklist"];
const SKILLS = ["ship", ...SPECIALISTS];
const GOOSE_START = "# pre-ship-checklist-skill:start";
const GOOSE_END = "# pre-ship-checklist-skill:end";

const AGENTS = {
  claude: {
    label: "Claude Code",
    env: "CLAUDE_SKILLS_DIR",
    global: () => join(homedir(), ".claude", "skills"),
    project: () => join(process.cwd(), ".claude", "skills")
  },
  "claude-code": { aliasFor: "claude" },
  codex: {
    label: "Codex",
    env: "CODEX_SKILLS_DIR",
    global: () => join(homedir(), ".agents", "skills"),
    project: () => join(process.cwd(), ".agents", "skills")
  },
  openclaw: {
    label: "OpenClaw",
    env: "OPENCLAW_SKILLS_DIR",
    global: () => join(homedir(), ".openclaw", "skills"),
    project: () => join(process.cwd(), "skills")
  },
  hermes: {
    label: "Hermes Agent",
    env: "HERMES_SKILLS_DIR",
    global: () => join(homedir(), ".hermes", "skills"),
    project: () => join(process.cwd(), "skills")
  },
  pi: {
    label: "Pi coding agent",
    env: "PI_SKILLS_DIR",
    global: () => join(homedir(), ".pi", "agent", "skills"),
    project: () => join(process.cwd(), ".pi", "skills")
  },
  agents: {
    label: "Generic AgentSkills",
    env: "AGENTS_SKILLS_DIR",
    global: () => join(homedir(), ".agents", "skills"),
    project: () => join(process.cwd(), ".agents", "skills")
  },
  goose: {
    label: "Goose",
    env: "GOOSE_HINTS_FILE",
    format: "goosehints",
    global: () => platform() === "win32" && process.env.APPDATA
      ? join(process.env.APPDATA, "Block", "goose", "config", ".goosehints")
      : join(homedir(), ".config", "goose", ".goosehints"),
    project: () => join(process.cwd(), ".goosehints")
  }
};

function agentFor(name) {
  const agent = AGENTS[name];
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  return agent.aliasFor ? agentFor(agent.aliasFor) : agent;
}

function targetFor(name, scope) {
  const agent = agentFor(name);
  return resolve(process.env[agent.env] || agent[scope]());
}

function version() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

function printHelp() {
  console.log(`pre-ship-checklist-skill v${version()}

Install and inspect three production-readiness skills.

Usage:
  pre-ship-checklist-skill install [options]
  pre-ship-checklist-skill list
  pre-ship-checklist-skill targets
  pre-ship-checklist-skill doctor [options]

Options:
  --agent <name>   claude, codex, openclaw, hermes, pi, agents, goose
  --scope <scope>  global or project (default: global)
  --target <path>  Custom skills directory, or Goose hints file
  --only <name>    ship, pre-launch-checklist, vibe-coder-security-checklist, all
  --force          Overwrite only managed files that differ
  --dry-run        Preview all planned files without writing
  --help, -h       Show this help
  --version, -v    Print package version

Defaults: --agent claude --scope global --only all
All folder-based agents receive <skills>/<name>/SKILL.md.
Existing flat Claude .skill files are not removed automatically.
Preferred manager: npx skills@1.7.2 add xPAlien/pre_ship_checklist_skill
See docs/skills-cli-migration.md before switching existing installations.`);
}

function parseOptions(args) {
  const options = {
    command: args[0] || "help",
    agentName: "claude",
    scope: "global",
    target: null,
    only: "all",
    force: false,
    dryRun: false
  };
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--agent" || arg === "--scope" || arg === "--target" || arg === "--only") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      if (arg === "--agent") options.agentName = value;
      if (arg === "--scope") options.scope = value;
      if (arg === "--target") options.target = resolve(value);
      if (arg === "--only") options.only = value;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (options.scope !== "global" && options.scope !== "project") {
    throw new Error("--scope must be global or project");
  }
  if (options.only !== "all" && !SKILLS.includes(options.only)) {
    throw new Error(`Unknown skill: ${options.only}`);
  }
  options.agent = agentFor(options.agentName);
  options.target = options.target || targetFor(options.agentName, options.scope);
  return options;
}

function selectedSkills(options) {
  return options.only === "all" ? SKILLS : [options.only];
}

function walkFiles(path) {
  if (!existsSync(path)) throw new Error(`Missing packaged skill directory: ${path}`);
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
    else throw new Error(`Unexpected non-file in skill: ${absolute}`);
  }
  return files;
}

function installPlan(options) {
  if (options.agent.format === "goosehints") return [];
  const plan = [];
  for (const skill of selectedSkills(options)) {
    const folder = join(options.target, skill);
    const sourceFolder = join(ROOT, "skills", skill);
    for (const source of walkFiles(sourceFolder)) {
      plan.push({ skill, source, destination: join(folder, relative(sourceFolder, source)) });
    }
  }
  return plan;
}

function fileEqual(a, b) {
  return readFileSync(a).equals(readFileSync(b));
}

function assertLegacyOwnership(options, plan) {
  // Do not follow a manager-owned symlink, even with --force.
  const boundary = dirname(options.target);
  for (const item of plan) {
    let cursor = item.destination;
    while (cursor !== boundary) {
      try {
        if (lstatSync(cursor).isSymbolicLink()) {
          throw new Error(`Refusing a symlink-managed destination: ${cursor}. Use its owning skill manager.`);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  // Copy-mode Skills CLI installs have no symlink. Respect its lock metadata
  // for native agent destinations. Custom targets still receive the link guard.
  const nativeTarget = resolve(options.agent[options.scope]());
  if (options.target !== nativeTarget) return;
  const lockPath = options.scope === "global"
    ? join(homedir(), ".agents", ".skill-lock.json")
    : join(process.cwd(), "skills-lock.json");
  if (!existsSync(lockPath)) return;
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  if (!lock.skills || typeof lock.skills !== "object") {
    throw new Error(`Unrecognized skill manager lock: ${lockPath}. No files were written.`);
  }
  const managed = selectedSkills(options).filter(name => Object.hasOwn(lock.skills, name));
  if (managed.length) {
    throw new Error(`Skills CLI owns ${managed.join(", ")}. Use npx skills update. No files were written.`);
  }
}

function installFiles(options) {
  const plan = installPlan(options);
  assertLegacyOwnership(options, plan);
  const conflicts = plan.filter(x => existsSync(x.destination) && !fileEqual(x.source, x.destination));
  if (conflicts.length > 0 && !options.force) {
    throw new Error(`Changed installed file(s) already exist. No files were written. Use --force after review:\n${conflicts.map(x => `- ${x.destination}`).join("\n")}`);
  }
  if (options.dryRun) {
    console.log(`Would install ${plan.length} managed file(s) for ${options.agent.label} to ${options.target}`);
    for (const item of plan) console.log(`- ${item.skill}: ${item.destination}`);
    return 0;
  }
  let copied = 0;
  let unchanged = 0;
  for (const item of plan) {
    if (existsSync(item.destination) && fileEqual(item.source, item.destination)) {
      unchanged += 1;
      continue;
    }
    mkdirSync(dirname(item.destination), { recursive: true });
    copyFileSync(item.source, item.destination);
    copied += 1;
  }
  console.log(`Installed ${copied} managed file(s) for ${options.agent.label} to ${options.target}. ${unchanged} unchanged.`);
  return 0;
}

function gooseContent(options) {
  const selected = selectedSkills(options);
  return `${GOOSE_START}
Pre-ship readiness guidance, managed by pre-ship-checklist-skill v${version()}.
Selected audits: ${selected.join(", ")}.
- Ship: use the eight evidence-based release gates. Default to a read-only audit. Unverified critical controls block release.
- Pre-launch: audit state, scale, database, async work, operations, monitoring, and recovery when applicable.
- Security: audit auth, object authorization, input validation, secrets, sessions, dependency risks, and uploads when applicable.
- Do not presume user confirmation equals tested evidence. Report PASS, FAIL, NEEDS VERIFICATION, or NOT APPLICABLE per control.
- Deliver GO, CONDITIONAL GO, or NO-GO with evidence and blockers. No merge, production deployment, credential rotation, or protection removal without separate authorization.
- Full authoritative checklists and scripts reside in this npm package. Goose hints are a summary, not a full AgentSkills installation.
${GOOSE_END}`;
}

function installGoose(options) {
  const content = gooseContent(options);
  const original = existsSync(options.target) ? readFileSync(options.target, "utf8") : "";
  const blockPattern = /# pre-ship-checklist-skill:start[\s\S]*?# pre-ship-checklist-skill:end/g;
  const next = blockPattern.test(original)
    ? original.replace(blockPattern, content)
    : original.trim() ? `${original.replace(/\s+$/u, "")}\n\n${content}\n` : `${content}\n`;
  if (options.dryRun) {
    console.log(`Would update Goose hints file: ${options.target}`);
    console.log(content);
    return 0;
  }
  mkdirSync(dirname(options.target), { recursive: true });
  writeFileSync(options.target, next, "utf8");
  console.log(`Installed Goose pre-ship hints to ${options.target}`);
  return 0;
}

function doctor(options) {
  console.log(`Package version: ${version()}\nAgent: ${options.agent.label}\nScope: ${options.scope}\nTarget: ${options.target}`);
  if (options.agent.format === "goosehints") {
    const installed = existsSync(options.target) && readFileSync(options.target, "utf8").includes(GOOSE_START);
    console.log(`Goose hints: ${installed ? "installed" : "missing"}`);
    return installed ? 0 : 1;
  }
  const plan = installPlan(options);
  let errors = 0;
  for (const item of plan) {
    const status = !existsSync(item.destination) ? "missing"
      : fileEqual(item.source, item.destination) ? "installed" : "changed";
    if (status !== "installed") errors += 1;
    console.log(`- ${item.destination}: ${status}`);
  }
  return errors === 0 ? 0 : 1;
}

function main(args) {
  if (args.length === 0 || ["--help", "-h", "help"].includes(args[0])) {
    printHelp();
    return 0;
  }
  if (["--version", "-v"].includes(args[0])) {
    console.log(version());
    return 0;
  }
  if (args[0] === "targets") {
    for (const [name, agent] of Object.entries(AGENTS)) {
      if (agent.aliasFor) continue;
      console.log(`${name}: ${agent.label}\n  global:  ${targetFor(name, "global")}\n  project: ${targetFor(name, "project")}`);
    }
    return 0;
  }
  if (args[0] === "list") {
    SKILLS.forEach(name => console.log(name));
    return 0;
  }
  if (!["install", "doctor"].includes(args[0])) throw new Error(`Unknown command: ${args[0]}`);
  const options = parseOptions(args);
  if (options.command === "doctor") return doctor(options);
  return options.agent.format === "goosehints" ? installGoose(options) : installFiles(options);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
