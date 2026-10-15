#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const {
  chmodSync,
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
const SPECIALISTS = ["pre-launch-checklist", "vibe-coder-security-checklist", "ai-code-review"];
const SKILLS = ["ship", ...SPECIALISTS];
const GOOSE_START = "# pre-ship-checklist-skill:start";
const GOOSE_END = "# pre-ship-checklist-skill:end";
const GIT_HOOK_MARKER = "pre-ship-checklist-skill:managed";
const HOOK_SOURCES = [
  ["skills/ship/hooks/ship-hooks-lib.cjs", "ship-hooks-lib.cjs"],
  ["skills/ship/hooks/deploy-guard.cjs", "deploy-guard.cjs"],
  ["skills/ship/hooks/post-deploy.cjs", "post-deploy.cjs"],
  ["skills/ship/hooks/git-pre-push.sh", "git-pre-push.sh"],
  ["skills/ship/scripts/preflight.py", "preflight.py"]
];
const HOOK_MATCHER = "Bash|mcp__.*[Vv]ercel.*";
const HOOK_COMMANDS = {
  PreToolUse: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/ship/deploy-guard.cjs"',
  PostToolUse: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/ship/post-deploy.cjs"'
};

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

Install and inspect four production-readiness skills.

Usage:
  pre-ship-checklist-skill install [options]
  pre-ship-checklist-skill list
  pre-ship-checklist-skill targets
  pre-ship-checklist-skill doctor [options]
  pre-ship-checklist-skill install-hooks [hook options]

Options:
  --agent <name>   claude, codex, openclaw, hermes, pi, agents, goose
  --scope <scope>  global or project (default: global)
  --target <path>  Custom skills directory, or Goose hints file
  --only <names>   ship, pre-launch-checklist, vibe-coder-security-checklist,
                   ai-code-review, all
                   (comma-separated list accepted)
  --force          Overwrite only managed files that differ
  --dry-run        Preview all planned files without writing
  --help, -h       Show this help
  --version, -v    Print package version

Hook options (project scope only, run from the project root):
  --git            Also install the Git pre-push secret floor
  --write-settings Merge the Claude Code hook entries into .claude/settings.json
                   (default: print the entries for you to add)
  --force          Overwrite only managed hook files that differ
  --dry-run        Preview without writing
Hooks are local guardrails, not CI enforcement.

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
    dryRun: false,
    git: false,
    writeSettings: false
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
    } else if (arg === "--git" && options.command === "install-hooks") {
      options.git = true;
    } else if (arg === "--write-settings" && options.command === "install-hooks") {
      options.writeSettings = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (options.scope !== "global" && options.scope !== "project") {
    throw new Error("--scope must be global or project");
  }
  options.skills = options.only === "all" ? SKILLS : [...new Set(options.only.split(",").map(name => name.trim()).filter(Boolean))];
  const unknown = options.skills.filter(name => !SKILLS.includes(name));
  if (unknown.length || options.skills.length === 0) {
    throw new Error(`Unknown skill: ${unknown.join(", ") || options.only}`);
  }
  options.agent = agentFor(options.agentName);
  options.target = options.target || targetFor(options.agentName, options.scope);
  return options;
}

function selectedSkills(options) {
  return options.skills;
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
- Code review: before merge, check AI-generated or unfamiliar changes for comprehension, edge cases, security, performance, observability, and fit. Block merge on CRITICAL or HIGH findings.
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

function hookPlan(projectRoot) {
  const folder = join(projectRoot, ".claude", "hooks", "ship");
  return HOOK_SOURCES.map(([source, name]) => ({ source: join(ROOT, source), destination: join(folder, name) }));
}

function gitHooksDir(projectRoot) {
  try {
    const path = execFileSync("git", ["-C", projectRoot, "rev-parse", "--git-path", "hooks"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return resolve(projectRoot, path);
  } catch {
    throw new Error(`--git needs a Git repository at ${projectRoot}. No files were written.`);
  }
}

function hookEntries() {
  const hooks = {};
  for (const [event, command] of Object.entries(HOOK_COMMANDS)) {
    hooks[event] = [{ matcher: HOOK_MATCHER, hooks: [{ type: "command", command, timeout: 30 }] }];
  }
  return { hooks };
}

function mergeSettings(settings) {
  const next = JSON.parse(JSON.stringify(settings));
  if (next.hooks !== undefined && (typeof next.hooks !== "object" || Array.isArray(next.hooks))) {
    throw new Error("Existing settings.hooks is not an object. No files were written.");
  }
  next.hooks = next.hooks || {};
  let added = 0;
  for (const [event, command] of Object.entries(HOOK_COMMANDS)) {
    const groups = next.hooks[event] = next.hooks[event] || [];
    if (!Array.isArray(groups)) throw new Error(`Existing settings.hooks.${event} is not an array. No files were written.`);
    const present = groups.some(group => Array.isArray(group && group.hooks) && group.hooks.some(hook => hook && hook.command === command));
    if (!present) {
      groups.push(hookEntries().hooks[event][0]);
      added += 1;
    }
  }
  return { next, added };
}

function installHooks(options) {
  if (options.scope !== "project") throw new Error("install-hooks supports --scope project only. Run it from the project root.");
  const projectRoot = process.cwd();
  const plan = hookPlan(projectRoot);
  // Validate every destination before writing anything.
  const conflicts = plan.filter(x => existsSync(x.destination) && !fileEqual(x.source, x.destination));
  let gitHook = null;
  if (options.git) {
    gitHook = join(gitHooksDir(projectRoot), "pre-push");
    if (existsSync(gitHook)) {
      const current = readFileSync(gitHook, "utf8");
      if (!current.includes(GIT_HOOK_MARKER)) {
        throw new Error(`An unmanaged Git pre-push hook exists: ${gitHook}. No files were written. Chain .claude/hooks/ship/git-pre-push.sh from it manually.`);
      }
      if (current !== readFileSync(join(ROOT, "skills/ship/hooks/git-pre-push.sh"), "utf8")) conflicts.push({ destination: gitHook });
    }
  }
  if (conflicts.length && !options.force) {
    throw new Error(`Changed managed hook file(s) already exist. No files were written. Use --force after review:\n${conflicts.map(x => `- ${x.destination}`).join("\n")}`);
  }
  const settingsPath = join(projectRoot, ".claude", "settings.json");
  let merged = null;
  if (options.writeSettings) {
    let current = {};
    if (existsSync(settingsPath)) {
      try {
        current = JSON.parse(readFileSync(settingsPath, "utf8"));
      } catch (error) {
        throw new Error(`Cannot parse ${settingsPath}: ${error.message}. No files were written.`);
      }
    }
    merged = mergeSettings(current);
  }
  if (options.dryRun) {
    console.log(`Would install ${plan.length} hook file(s) to ${join(projectRoot, ".claude", "hooks", "ship")}`);
    for (const item of plan) console.log(`- ${item.destination}`);
    if (gitHook) console.log(`Would install Git pre-push hook: ${gitHook}`);
    if (merged) console.log(`Would add ${merged.added} hook entr${merged.added === 1 ? "y" : "ies"} to ${settingsPath}`);
    return 0;
  }
  let copied = 0;
  for (const item of plan) {
    if (existsSync(item.destination) && fileEqual(item.source, item.destination)) continue;
    mkdirSync(dirname(item.destination), { recursive: true });
    copyFileSync(item.source, item.destination);
    copied += 1;
  }
  if (gitHook) {
    mkdirSync(dirname(gitHook), { recursive: true });
    copyFileSync(join(ROOT, "skills/ship/hooks/git-pre-push.sh"), gitHook);
    if (platform() !== "win32") chmodSync(gitHook, 0o755);
  }
  console.log(`Installed ${copied} hook file(s) to ${join(projectRoot, ".claude", "hooks", "ship")}. ${plan.length - copied} unchanged.`);
  if (gitHook) console.log(`Installed Git pre-push secret floor: ${gitHook}`);
  if (merged) {
    if (merged.added > 0) {
      mkdirSync(dirname(settingsPath), { recursive: true });
      writeFileSync(settingsPath, `${JSON.stringify(merged.next, null, 2)}\n`, "utf8");
    }
    console.log(`Added ${merged.added} hook entr${merged.added === 1 ? "y" : "ies"} to ${settingsPath}.`);
  } else {
    console.log(`Add these entries to ${settingsPath} to activate the Claude Code hooks, or re-run with --write-settings:`);
    console.log(JSON.stringify(hookEntries(), null, 2));
  }
  console.log("Hooks are local guardrails. Keep protected branches and required CI checks as the enforced release boundary.");
  return 0;
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
  if (!["install", "doctor", "install-hooks"].includes(args[0])) throw new Error(`Unknown command: ${args[0]}`);
  const options = parseOptions(args[0] === "install-hooks" && !args.includes("--scope") ? [...args, "--scope", "project"] : args);
  if (options.command === "install-hooks") return installHooks(options);
  if (options.command === "doctor") return doctor(options);
  return options.agent.format === "goosehints" ? installGoose(options) : installFiles(options);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
