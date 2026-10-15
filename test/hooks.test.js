const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..')
const hooks = join(root, 'skills', 'ship', 'hooks')
const cli = join(root, 'bin', 'pre-ship-checklist-skill.js')
const lib = require(join(hooks, 'ship-hooks-lib.cjs'))
const example = JSON.parse(readFileSync(join(root, 'skills', 'ship', 'templates', 'ship-report.example.json'), 'utf8'))

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ship-hooks-'))
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(dir, '.gitconfig-none') }
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir, env })
  execFileSync('git', ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir, env })
  return dir
}

function head(dir) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
}

function writeReport(dir, patch = {}) {
  const report = JSON.parse(JSON.stringify(example))
  report.findings = report.findings.filter(f => f.severity === 'P2')
  report.findings[0].accepted_by = 'Owner'
  for (const gate of Object.values(report.gates)) if (gate.decision !== 'NOT APPLICABLE') gate.decision = 'PASS'
  Object.assign(report, { verdict: 'CONDITIONAL GO', generated_utc: new Date().toISOString(), revision: { sha: head(dir), branch: 'main' } }, patch)
  mkdirSync(join(dir, '.ship'), { recursive: true })
  writeFileSync(join(dir, '.ship', 'report.json'), JSON.stringify(report))
  return report
}

function guard(dir, toolName, toolInput, env = {}) {
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: dir, hook_event_name: 'PreToolUse' })
  const result = spawnSync(process.execPath, [join(hooks, 'deploy-guard.cjs')], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env } })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput : null
}

test('classifier separates release, confirm, and unrelated commands', () => {
  const dir = repo()
  try {
    const cases = [
      ['vercel --prod', 'release'], ['npm test && vercel deploy --prebuilt --prod', 'release'], ['vercel deploy --target=production', 'release'],
      ['vercel promote https://x.vercel.app', 'release'], ['vercel rollback', 'release'], ['vercel rolling-release complete --dpl x', 'release'],
      ['vercel alias set a.vercel.app example.com', 'release'], ['gh pr merge 12 --squash', 'release'], ['npm publish', 'release'],
      ['git push origin main', 'release'], ['git push origin HEAD:production', 'release'], ['git push', 'release'],
      ['npx prisma migrate deploy', 'confirm'], ['vercel env pull .env.local', 'confirm'], ['vercel firewall rules add x', 'confirm'],
      ['vercel list', null], ['vercel promote status', null], ['vercel rollback status', null], ['vercel alias ls', null],
      ['vercel rolling-release abort --dpl x', null], ['git push -u origin feat/x', null], ['vercel deploy', null], ['npm test', null]
    ]
    for (const [command, tier] of cases) {
      const result = lib.classify('Bash', { command }, dir, {})
      assert.equal(result ? result.tier : null, tier, command)
    }
    assert.equal(lib.classify('mcp__vercel__request_promote', {}, dir).tier, 'release')
    assert.equal(lib.classify('mcp__Vercel__create_deployment', { requestBody: { target: 'production' } }, dir).tier, 'release')
    assert.equal(lib.classify('mcp__Vercel__create_deployment', { requestBody: {} }, dir), null)
    assert.equal(lib.classify('mcp__Vercel__edit_project_env', {}, dir).tier, 'confirm')
    assert.equal(lib.classify('mcp__Vercel__get_runtime_errors', {}, dir), null)
    assert.equal(lib.classify('Bash', { command: 'git push origin release' }, dir, { SHIP_PRODUCTION_BRANCHES: 'release' }).tier, 'release')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('guard denies without a fresh, matching, passing report and asks otherwise', () => {
  const dir = repo()
  try {
    assert.match(guard(dir, 'Bash', { command: 'vercel --prod' }).permissionDecisionReason, /No Ship report/)
    assert.equal(guard(dir, 'Bash', { command: 'vercel list' }), null)
    assert.equal(guard(dir, 'Bash', { command: 'npx drizzle-kit push' }).permissionDecision, 'ask')

    writeReport(dir, { revision: { sha: 'f'.repeat(40) } })
    let out = guard(dir, 'Bash', { command: 'vercel --prod' })
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /differs from HEAD/)

    writeReport(dir, { generated_utc: new Date(Date.now() - 48 * 3600000).toISOString() })
    assert.match(guard(dir, 'Bash', { command: 'vercel --prod' }).permissionDecisionReason, /old, limit 24h/)
    assert.equal(guard(dir, 'Bash', { command: 'vercel --prod' }, { SHIP_REPORT_MAX_AGE_HOURS: '72' }).permissionDecision, 'ask')

    writeReport(dir, { verdict: 'GO', findings: [example.findings[0]] })
    out = guard(dir, 'Bash', { command: 'git push origin main' })
    assert.equal(out.permissionDecision, 'deny')
    assert.match(out.permissionDecisionReason, /after recomputing/)

    writeReport(dir)
    out = guard(dir, 'mcp__vercel__request_promote', {})
    assert.equal(out.permissionDecision, 'ask')
    assert.match(out.permissionDecisionReason, /CONDITIONAL GO.*not approval/)

    writeFileSync(join(dir, '.ship', 'report.json'), '{broken')
    assert.match(guard(dir, 'Bash', { command: 'vercel --prod' }).permissionDecisionReason, /not valid JSON/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('guard ignores malformed hook input', () => {
  const result = spawnSync(process.execPath, [join(hooks, 'deploy-guard.cjs')], { input: 'not json', encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})

test('post-deploy hook returns follow-through context without network when disabled', () => {
  const dir = repo()
  try {
    writeReport(dir)
    const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'vercel deploy --prod' }, tool_response: { stdout: 'Production: https://fixture-abc.vercel.app', stderr: '' }, cwd: dir })
    const result = spawnSync(process.execPath, [join(hooks, 'post-deploy.cjs')], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, SHIP_SMOKE: '0' } })
    assert.equal(result.status, 0, result.stderr)
    const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext
    assert.match(context, /SHIP_SMOKE=0/)
    assert.match(context, /G7-08/)
    assert.match(context, /Rollback triggers from the report: 5xx rate/)
    const unrelated = spawnSync(process.execPath, [join(hooks, 'post-deploy.cjs')], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npx prisma migrate deploy' }, cwd: dir }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, SHIP_SMOKE: '0' } })
    assert.equal(unrelated.stdout, '')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('install-hooks dry run, settings merge, idempotency, and collision handling', () => {
  const dir = repo()
  const run = (...args) => spawnSync(process.execPath, [cli, 'install-hooks', ...args], { cwd: dir, encoding: 'utf8' })
  try {
    mkdirSync(join(dir, '.claude'))
    writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo keep' }] }] } }))
    let result = run('--dry-run', '--git', '--write-settings')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Would add 2 hook entries/)
    assert.equal(existsSync(join(dir, '.claude', 'hooks')), false)

    result = run()
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Add these entries/)
    assert.ok(!JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).hooks.PostToolUse, 'settings untouched without --write-settings')

    result = run('--git', '--write-settings')
    assert.equal(result.status, 0, result.stderr)
    const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'))
    assert.deepEqual(settings.permissions, { allow: ['Bash(npm test)'] })
    assert.equal(settings.hooks.PreToolUse.length, 2)
    assert.equal(settings.hooks.PreToolUse[0].hooks[0].command, 'echo keep')
    assert.match(settings.hooks.PostToolUse[0].hooks[0].command, /post-deploy\.cjs/)
    const prePush = join(dir, '.git', 'hooks', 'pre-push')
    assert.match(readFileSync(prePush, 'utf8'), /pre-ship-checklist-skill:managed/)
    if (process.platform !== 'win32') assert.ok(statSync(prePush).mode & 0o100)

    assert.match(run('--git', '--write-settings').stdout, /Added 0 hook entries/)
    assert.equal(JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).hooks.PreToolUse.length, 2)

    writeFileSync(join(dir, '.claude', 'hooks', 'ship', 'deploy-guard.cjs'), '// local edit\n')
    result = run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /No files were written/)
    assert.equal(readFileSync(join(dir, '.claude', 'hooks', 'ship', 'deploy-guard.cjs'), 'utf8'), '// local edit\n')
    assert.equal(run('--force').status, 0)

    writeFileSync(prePush, '#!/bin/sh\necho custom\n')
    result = run('--git', '--force')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /unmanaged Git pre-push hook/)
    assert.equal(readFileSync(prePush, 'utf8'), '#!/bin/sh\necho custom\n')

    writeFileSync(join(dir, '.claude', 'settings.json'), '{bad json')
    result = run('--write-settings')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Cannot parse/)
    assert.equal(run('--scope', 'global').status, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
