#!/usr/bin/env node

const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} = require("node:fs");
const { basename, dirname, join, resolve } = require("node:path");
const { homedir, platform } = require("node:os");

const ROOT_DIR = join(__dirname, "..");
const SKILL_FILES = [
  "pre-launch-checklist.skill",
  "vibe-coder-security-checklist.skill"
];

const GOOSE_BLOCK_START = "# pre-ship-checklist-skill:start";
const GOOSE_BLOCK_END = "# pre-ship-checklist-skill:end";

const AGENTS = {
  claude: {
    label: "Claude Code",
    format: "flat",
    env: "CLAUDE_SKILLS_DIR",
    global: () => join(homedir(), ".claude", "skills"),
    project: () => join(process.cwd(), ".claude", "skills")
  },
  "claude-code": {
    aliasFor: "claude"
  },
  openclaw: {
    label: "OpenClaw",
    format: "agentskills",
    env: "OPENCLAW_SKILLS_DIR",
    global: () => join(homedir(), ".openclaw", "skills"),
    project: () => join(process.cwd(), "skills")
  },
  hermes: {
    label: "Hermes Agent",
    format: "agentskills",
    env: "HERMES_SKILLS_DIR",
    global: () => join(homedir(), ".hermes", "skills"),
    project: () => join(process.cwd(), "skills")
  },
  pi: {
    label: "Pi coding agent",
    format: "agentskills",
    env: "PI_SKILLS_DIR",
    global: () => join(homedir(), ".pi", "agent", "skills"),
    project: () => join(process.cwd(), ".pi", "skills")
  },
  agents: {
    label: "Generic AgentSkills",
    format: "agentskills",
    env: "AGENTS_SKILLS_DIR",
    global: () => join(homedir(), ".agents", "skills"),
    project: () => join(process.cwd(), ".agents", "skills")
  },
  goose: {
    label: "Goose",
    format: "goosehints",
    env: "GOOSE_HINTS_FILE",
    global: () => {
      if (platform() === "win32" && process.env.APPDATA) {
        return join(process.env.APPDATA, "Block", "goose", "config", ".goosehints");
      }

      return join(homedir(), ".config", "goose", ".goosehints");
    },
    project: () => join(process.cwd(), ".goosehints")
  }
};

function resolveAgent(agentName) {
  const agent = AGENTS[agentName];

  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  if (agent.aliasFor) {
    return resolveAgent(agent.aliasFor);
  }

  return agent;
}

function defaultTarget(agentName, scope) {
  const agent = resolveAgent(agentName);

  if (agent.env && process.env[agent.env]) {
    return resolve(process.env[agent.env]);
  }

  if (scope === "project") {
    return agent.project();
  }

  return agent.global();
}

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8"));
  return packageJson.version;
}

function printHelp() {
  console.log(`pre-ship-checklist-skill

Install pre-ship checklist skills for Claude Code and compatible AI agents.

Usage:
  pre-ship-checklist-skill install [options]
  pre-ship-checklist-skill list
  pre-ship-checklist-skill targets
  pre-ship-checklist-skill doctor [options]

Options:
  --agent <name>   claude, openclaw, hermes, pi, agents, or goose
  --scope <scope>  global or project
  --target <path>  Install into a specific directory or file
  --force          Overwrite existing changed skill files
  --dry-run        Show what would be installed without writing files
  --help, -h       Show this help message
  --version, -v    Print the package version

Defaults:
  --agent claude --scope global`);
}

function parseOptions(args) {
  const options = {
    command: args[0] || "help",
    agentName: "claude",
    scope: "global",
    target: null,
    force: false,
    dryRun: false
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--agent") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--agent requires a value");
      }
      options.agentName = value;
      index += 1;
    } else if (arg === "--scope") {
      const value = args[index + 1];
      if (value !== "global" && value !== "project") {
        throw new Error("--scope must be global or project");
      }
      options.scope = value;
      index += 1;
    } else if (arg === "--target") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--target requires a path");
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

  options.agent = resolveAgent(options.agentName);
  options.target = options.target || defaultTarget(options.agentName, options.scope);

  return options;
}

function listSkills() {
  for (const file of SKILL_FILES) {
    console.log(file);
  }
}

function listTargets() {
  for (const [name, agent] of Object.entries(AGENTS)) {
    if (agent.aliasFor) {
      continue;
    }

    console.log(`${name}: ${agent.label}`);
    console.log(`  global:  ${defaultTarget(name, "global")}`);
    console.log(`  project: ${defaultTarget(name, "project")}`);
  }
}

function readSkill(file) {
  const source = join(ROOT_DIR, file);
  const content = readFileSync(source, "utf8");
  const nameMatch = content.match(/^name:\s*["']?([^"'\r\n]+)["']?/m);

  return {
    file,
    source,
    content,
    name: nameMatch ? nameMatch[1].trim() : basename(file, ".skill")
  };
}

function getInstallPlan(options) {
  if (options.agent.format === "goosehints") {
    return [
      {
        kind: "goosehints",
        destination: options.target
      }
    ];
  }

  return SKILL_FILES.map(file => {
    const skill = readSkill(file);
    const destination =
      options.agent.format === "agentskills"
        ? join(options.target, skill.name, "SKILL.md")
        : join(options.target, basename(file));

    return {
      kind: "skill",
      source: skill.source,
      destination,
      label: options.agent.format === "agentskills" ? `${skill.name}/SKILL.md` : basename(file)
    };
  });
}

function installSkillFiles(options) {
  const plan = getInstallPlan(options);

  if (options.dryRun) {
    console.log(`Would install ${plan.length} skill file(s) for ${options.agent.label} to ${options.target}`);
    for (const item of plan) {
      console.log(`- ${item.label} -> ${item.destination}`);
    }
    return 0;
  }

  const copied = [];
  const skipped = [];

  for (const item of plan) {
    if (!existsSync(item.source)) {
      throw new Error(`Missing packaged skill file: ${basename(item.source)}`);
    }

    mkdirSync(dirname(item.destination), { recursive: true });

    if (existsSync(item.destination) && !options.force) {
      const sourceContent = readFileSync(item.source, "utf8");
      const destinationContent = readFileSync(item.destination, "utf8");

      if (sourceContent !== destinationContent) {
        throw new Error(`${item.destination} already exists. Re-run with --force to overwrite it.`);
      }

      skipped.push(item.destination);
      continue;
    }

    copyFileSync(item.source, item.destination);
    copied.push(item.destination);
  }

  console.log(`Installed ${copied.length} skill file(s) for ${options.agent.label} to ${options.target}`);

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} unchanged existing file(s).`);
  }

  return 0;
}

function gooseHintsContent() {
  return `${GOOSE_BLOCK_START}
Pre-ship checklist guidance:
- Before launch or client delivery, run the pre-launch production checklist and the pre-ship security checklist.
- Production readiness areas: load, database, async work, resilience, observability, and operations.
- Security areas: authentication, API authorization, input validation, CORS/HTTPS/CSRF, database hardening, infrastructure secrets, dependency checks, and upload validation.
- Treat blocker findings as must-fix before delivery. Treat warning findings as follow-up work within 30 days.
- Produce reports with BLOCKERS, WARNINGS, NOT APPLICABLE, and PASSED sections.
${GOOSE_BLOCK_END}`;
}

function installGooseHints(options) {
  const content = gooseHintsContent();

  if (options.dryRun) {
    console.log(`Would update Goose hints file: ${options.target}`);
    console.log(content);
    return 0;
  }

  mkdirSync(dirname(options.target), { recursive: true });

  const existing = existsSync(options.target) ? readFileSync(options.target, "utf8") : "";
  const blockPattern = new RegExp(`${GOOSE_BLOCK_START}[\\s\\S]*?${GOOSE_BLOCK_END}`);
  let nextContent;

  if (blockPattern.test(existing)) {
    nextContent = existing.replace(blockPattern, content);
  } else if (existing.trim().length > 0) {
    nextContent = `${existing.replace(/\s+$/u, "")}\n\n${content}\n`;
  } else {
    nextContent = `${content}\n`;
  }

  writeFileSync(options.target, nextContent, "utf8");
  console.log(`Installed Goose pre-ship hints to ${options.target}`);
  return 0;
}

function install(options) {
  if (options.agent.format === "goosehints") {
    return installGooseHints(options);
  }

  return installSkillFiles(options);
}

function doctor(options) {
  console.log(`Package version: ${readPackageVersion()}`);
  console.log(`Agent: ${options.agent.label}`);
  console.log(`Scope: ${options.scope}`);
  console.log(`Target: ${options.target}`);
  console.log("Install plan:");

  for (const item of getInstallPlan(options)) {
    const status = item.kind === "goosehints"
      ? existsSync(item.destination) ? "exists" : "missing"
      : existsSync(item.source) ? "packaged" : "missing source";
    console.log(`- ${item.destination}: ${status}`);
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

  if (args[0] === "targets") {
    listTargets();
    return 0;
  }

  const options = parseOptions(args);

  if (options.command === "install") {
    return install(options);
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
