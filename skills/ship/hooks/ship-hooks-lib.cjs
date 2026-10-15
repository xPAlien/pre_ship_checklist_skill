"use strict";
// Shared logic for the Ship Claude Code hooks. Node 18+, no dependencies.
// These hooks are local guardrails. They do not replace protected branches, required CI checks,
// or provider permissions. Anyone running the same command outside the agent bypasses them.

const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");

const DEFAULT_MAX_AGE_HOURS = 24;

// Release actions need a fresh, passing Ship report for the current HEAD.
const RELEASE_COMMANDS = [
  [/\bvercel\b[^|;&\n]*\s--prod\b/, "vercel production deployment"],
  [/\bvercel\b[^|;&\n]*\s--target[= ]production\b/, "vercel production deployment"],
  [/\bvercel\s+promote\b(?!\s+status\b)/, "vercel promote"],
  [/\bvercel\s+rollback\b(?!\s+status\b)/, "vercel rollback"],
  [/\bvercel\s+rolling-release\s+(?:start|approve|complete)\b/, "vercel rolling release advance"],
  [/\bvercel\s+alias\s+(?:set\s+)?(?!ls\b|list\b|rm\b|remove\b|-)\S+\s+\S+/, "vercel alias assignment"],
  [/\bgh\s+pr\s+merge\b/, "pull request merge"],
  [/\b(?:npm|pnpm)\s+publish\b|\byarn\s+(?:npm\s+)?publish\b/, "package publish"],
];

// Data and configuration actions always need a person to confirm the target, whatever the report says.
const CONFIRM_COMMANDS = [
  [/\bprisma\s+(?:migrate\s+(?:deploy|reset)|db\s+push)\b/, "database migration"],
  [/\bdrizzle-kit\s+(?:migrate|push)\b/, "database migration"],
  [/\bsupabase\s+db\s+(?:push|reset)\b/, "database migration"],
  [/\bknex\s+migrate:(?:latest|up|rollback)\b|\bsequelize\s+db:migrate\b|\brails\s+db:migrate\b|\balembic\s+(?:upgrade|downgrade)\b/, "database migration"],
  [/\bvercel\s+env\s+(?:add|rm|remove|update|pull)\b/, "vercel environment variable change or download"],
  [/\bvercel\s+(?:firewall|domains|dns|certs)\s+(?!ls\b|list\b|inspect\b)\S+/, "vercel provider configuration change"],
  [/\bvercel\s+rolling-release\s+configure\b/, "vercel rolling release configuration"],
];

const MCP_RELEASE = /__(?:request_promote|request_rollback|start_rolling_release|approve_rolling_release_stage|complete_rolling_release|assign_alias)$/;
const MCP_CONFIRM = /__(?:create_project_env|edit_project_env|update_project_protection_bypass|patch_url_protection_bypass|update_firewall_config|put_firewall_config|update_attack_challenge_mode|pause_project|unpause_project|update_project|add_project_domain|create_record|update_record|replace_domain_dns_records|update_rolling_release_config|restore_edge_config_backup|update_edge_config|patch_edge_config_items)$/;

function productionBranches(env = process.env) {
  return (env.SHIP_PRODUCTION_BRANCHES || "main,master,production").split(",").map(s => s.trim()).filter(Boolean);
}

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

// Returns the branch a `git push` segment targets, or null when it is not a push.
function pushTarget(segment, cwd) {
  const match = segment.match(/\bgit\s+push\b(.*)$/);
  if (!match) return null;
  const args = match[1].trim().split(/\s+/).filter(Boolean).filter(arg => !arg.startsWith("-"));
  const refspecs = args.slice(1);
  if (refspecs.length === 0) return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  return refspecs.map(spec => {
    const dest = spec.includes(":") ? spec.split(":").pop() : spec;
    return dest.replace(/^\+/, "").replace(/^refs\/heads\//, "");
  }).join(",");
}

function classify(toolName, toolInput, cwd, env = process.env) {
  if (toolName === "Bash") {
    const command = String((toolInput && toolInput.command) || "");
    for (const segment of command.split(/&&|\|\||;|\n/)) {
      for (const [regex, label] of RELEASE_COMMANDS) if (regex.test(segment)) return { tier: "release", label };
      const target = pushTarget(segment, cwd);
      if (target !== null) {
        const hits = target.split(",").filter(branch => productionBranches(env).includes(branch));
        if (hits.length) return { tier: "release", label: `git push to production branch ${hits.join(", ")}` };
      }
      for (const [regex, label] of CONFIRM_COMMANDS) if (regex.test(segment)) return { tier: "confirm", label };
    }
    return null;
  }
  if (/^mcp__.*vercel/i.test(toolName)) {
    if (/__create_deployment$/.test(toolName)) {
      const body = (toolInput && toolInput.requestBody) || {};
      return body.target === "production" ? { tier: "release", label: "Vercel MCP production deployment" } : null;
    }
    if (MCP_RELEASE.test(toolName)) return { tier: "release", label: `Vercel MCP ${toolName.split("__").pop()}` };
    if (MCP_CONFIRM.test(toolName)) return { tier: "confirm", label: `Vercel MCP ${toolName.split("__").pop()}` };
  }
  return null;
}

function projectDir(input, env = process.env) {
  return resolve(env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd());
}

function reportPath(dir, env = process.env) {
  return env.SHIP_REPORT_PATH ? resolve(dir, env.SHIP_REPORT_PATH) : join(dir, ".ship", "report.json");
}

function readReport(path) {
  if (!existsSync(path)) return { error: `No Ship report at ${path}. Run the ship audit and save .ship/report.json first.` };
  try {
    return { report: JSON.parse(readFileSync(path, "utf8")), mtime: statSync(path).mtimeMs };
  } catch (error) {
    return { error: `Ship report at ${path} is not valid JSON (${error.message}).` };
  }
}

// Recompute the verdict floor so a hand-edited verdict field alone never passes the guard.
function effectiveVerdict(report) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const open = findings.filter(f => f && (f.status === "FAIL" || f.status === "NEEDS VERIFICATION"));
  if (open.some(f => f.severity === "P0" || f.severity === "P1")) return "NO-GO";
  if (open.some(f => f.critical && f.status === "NEEDS VERIFICATION")) return "NO-GO";
  const gates = report.gates && typeof report.gates === "object" ? Object.values(report.gates) : [];
  if (gates.some(g => g && g.critical && (g.decision === "FAIL" || g.decision === "NEEDS VERIFICATION"))) return "NO-GO";
  return ["GO", "CONDITIONAL GO", "NO-GO"].includes(report.verdict) ? report.verdict : "NO-GO";
}

function reportAgeHours(report, mtime, now = Date.now()) {
  const generated = Date.parse(report.generated_utc);
  return (now - (Number.isFinite(generated) ? generated : mtime)) / 3600000;
}

// Returns { decision: "deny" | "ask", reason }.
function decide(classification, input, env = process.env, now = Date.now()) {
  const label = classification.label;
  if (classification.tier === "confirm") {
    return { decision: "ask", reason: `Ship guard: ${label}. Confirm the exact target environment and that a person approved this change. Production data and provider settings need separate authorization.` };
  }
  const dir = projectDir(input, env);
  const loaded = readReport(reportPath(dir, env));
  if (loaded.error) return { decision: "deny", reason: `Ship guard blocked ${label}. ${loaded.error}` };
  const { report, mtime } = loaded;
  const head = git(dir, ["rev-parse", "HEAD"]);
  const sha = report.revision && report.revision.sha;
  if (!head) return { decision: "deny", reason: `Ship guard blocked ${label}. Git HEAD unavailable in ${dir}, so the report revision is unverifiable.` };
  if (sha !== head) return { decision: "deny", reason: `Ship guard blocked ${label}. Report revision ${String(sha).slice(0, 12)} differs from HEAD ${head.slice(0, 12)}. Re-run the ship audit for this commit.` };
  const maxAge = Number(env.SHIP_REPORT_MAX_AGE_HOURS || DEFAULT_MAX_AGE_HOURS);
  const age = reportAgeHours(report, mtime, now);
  if (!(age <= maxAge)) return { decision: "deny", reason: `Ship guard blocked ${label}. Report is ${Math.round(age)}h old, limit ${maxAge}h. Re-run the ship audit.` };
  const verdict = effectiveVerdict(report);
  if (verdict === "NO-GO") return { decision: "deny", reason: `Ship guard blocked ${label}. Report for ${head.slice(0, 12)} is NO-GO${report.verdict !== "NO-GO" ? " after recomputing open P0/P1 findings and critical unknowns" : ""}. Fix the blockers and re-run the audit.` };
  const target = report.target ? `${report.target.provider || "?"} ${report.target.environment || "?"} ${report.target.domain || ""}`.trim() : "unrecorded target";
  return { decision: "ask", reason: `Ship report ${verdict} for ${head.slice(0, 12)} (${target}). A verdict is not approval. Confirm a person authorized this exact action: ${label}.` };
}

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

module.exports = { classify, decide, effectiveVerdict, productionBranches, projectDir, pushTarget, readReport, readStdin, reportPath };
