#!/usr/bin/env node
"use strict";
// Claude Code PreToolUse hook. Blocks release actions without a fresh passing Ship report
// for the current HEAD, and asks a person to confirm every release, migration, or provider change.
// Exit 0 with a JSON decision. Unrelated tool calls produce no output.

const { classify, decide, projectDir, readStdin } = require("./ship-hooks-lib.cjs");

function main() {
  const input = readStdin();
  if (!input) return 0;
  const classification = classify(input.tool_name, input.tool_input, projectDir(input));
  if (!classification) return 0;
  const { decision, reason } = decide(classification, input);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason }
  }));
  return 0;
}

process.exitCode = main();
