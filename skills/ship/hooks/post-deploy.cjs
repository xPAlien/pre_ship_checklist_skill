#!/usr/bin/env node
"use strict";
// Claude Code PostToolUse hook. After a release action, runs read-only HTTP smoke checks against
// deployment URLs found in the command output and hands the G7-08 follow-through list back to the agent.
// Environment:
//   SHIP_SMOKE=0                 skip network checks
//   SHIP_SMOKE_PATHS=/,/api/health   paths expected to answer below 400 (default "/")
//   SHIP_PROTECTED_PATHS=/dashboard  paths expected to refuse anonymous access (401, 403, or redirect)
// Sends plain GET requests without cookies, tokens, or protection bypass headers.

const { classify, projectDir, readReport, readStdin, reportPath } = require("./ship-hooks-lib.cjs");

const DEPLOY_LABELS = /deployment|promote|rollback|rolling release|alias/i;

function urlsFrom(text, report) {
  const found = new Set((String(text).match(/https:\/\/[a-z0-9][a-z0-9.-]*\.vercel\.app\b/gi) || []).map(u => u.toLowerCase()));
  const domain = report && report.target && report.target.domain;
  if (domain && /^[a-z0-9.-]+$/i.test(domain)) found.add(`https://${domain.toLowerCase()}`);
  return [...found].slice(0, 3);
}

function paths(value, fallback) {
  return (value || fallback).split(",").map(p => p.trim()).filter(p => p.startsWith("/"));
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "ship-post-deploy-smoke" } });
    return { url, status: response.status };
  } catch (error) {
    return { url, status: 0, error: error.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function smoke(bases, env) {
  const lines = [];
  for (const base of bases) {
    for (const path of paths(env.SHIP_SMOKE_PATHS, "/")) {
      const r = await probe(base + path);
      const ok = r.status > 0 && r.status < 400;
      const note = r.status === 401 || r.status === 403 ? " (deployment protection or auth active)" : "";
      lines.push(`${ok ? "OK" : "CHECK"} GET ${r.url} -> ${r.status || r.error}${note}`);
    }
    for (const path of paths(env.SHIP_PROTECTED_PATHS, "")) {
      const r = await probe(base + path);
      const refused = [401, 403].includes(r.status) || (r.status >= 300 && r.status < 400);
      lines.push(`${refused ? "OK" : "FAIL"} anonymous GET ${r.url} -> ${r.status || r.error} (expected refusal)`);
    }
  }
  return lines;
}

async function main(env = process.env) {
  const input = readStdin();
  if (!input) return 0;
  const dir = projectDir(input, env);
  const classification = classify(input.tool_name, input.tool_input, dir, env);
  if (!classification || classification.tier !== "release" || !DEPLOY_LABELS.test(classification.label)) return 0;
  const response = input.tool_response || {};
  const output = typeof response === "string" ? response : `${response.stdout || ""}\n${response.stderr || ""}\n${JSON.stringify(response).slice(0, 20000)}`;
  const { report } = readReport(reportPath(dir, env));
  const bases = urlsFrom(output, report);
  const lines = [`Ship post-deploy follow-through for ${classification.label}.`];
  if (env.SHIP_SMOKE === "0") lines.push("Network smoke checks skipped (SHIP_SMOKE=0).");
  else if (bases.length === 0) lines.push("No deployment URL found in the output or report target. Run smoke checks manually.");
  else lines.push(...await smoke(bases, env));
  lines.push(
    "Complete G7-08 before calling the release done:",
    "- Confirm the production deployment ID and Git SHA match the approved revision.",
    "- Confirm protected routes refuse anonymous access and key flows work with approved test identities.",
    "- Watch runtime errors for the agreed window: Vercel MCP get_runtime_errors, or `vercel logs --environment production --level error --since 5m`.",
    "- If a rolling release is active, abort with `vercel rolling-release abort --dpl <url>` when a rollback trigger fires.",
    "- Rollback changes routing only. Database writes, emails, and payments need the separate recovery plan.",
  );
  const triggers = report && report.runbook && Array.isArray(report.runbook.rollback_triggers) ? report.runbook.rollback_triggers : [];
  if (triggers.length) lines.push(`Rollback triggers from the report: ${triggers.join("; ")}.`);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: lines.join("\n") } }));
  return 0;
}

main().then(code => { process.exitCode = code; }, error => {
  process.stderr.write(`ship post-deploy hook error: ${error.message}\n`);
  process.exitCode = 0;
});
