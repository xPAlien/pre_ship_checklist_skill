// Real upstream CLI integration. All writes remain inside disposable fixtures.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const root = resolve(__dirname, '..')
const entry = process.env.SKILLS_CLI_ENTRY || join(process.env.RUNNER_TEMP || '', 'pre-ship-skills-cli', 'node_modules', 'skills', 'bin', 'cli.mjs')
assert.ok(existsSync(entry), 'Install skills@1.7.2 into RUNNER_TEMP/pre-ship-skills-cli or set SKILLS_CLI_ENTRY')
const names = ['ship', 'pre-launch-checklist', 'vibe-coder-security-checklist', 'ai-code-review']
const sandbox = mkdtempSync(join(tmpdir(), 'ship-real-cli-'))
const logs = []
function environment(label) {
  const home = join(sandbox, label, 'home')
  const cwd = join(sandbox, label, 'project')
  mkdirSync(home, { recursive: true })
  mkdirSync(cwd, { recursive: true })
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, '.config'), APPDATA: join(home, 'AppData', 'Roaming'), LOCALAPPDATA: join(home, 'AppData', 'Local'), CODEX_HOME: join(home, '.codex'), CLAUDE_CONFIG_DIR: join(home, '.claude'), DO_NOT_TRACK: '1', CI: '1', NO_COLOR: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, '.gitconfig'), GIT_TERMINAL_PROMPT: '0' }
  for (const key of ['GITHUB_TOKEN', 'GH_TOKEN', 'GH_HOST', 'CODEX_SKILLS_DIR', 'CLAUDE_SKILLS_DIR', 'AGENTS_SKILLS_DIR', 'AGENTS_HOME', 'SKILLS_HOME', 'GIT_CONFIG_COUNT']) delete env[key]
  writeFileSync(env.GIT_CONFIG_GLOBAL, '')
  return { home, cwd, env }
}
function run(state, args) {
  const output = execFileSync(process.execPath, [entry, ...args], { cwd: state.cwd, env: state.env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  logs.push({ command: ['skills@1.7.2', ...args], output })
  return output
}
function git(state, cwd, args) {
  return execFileSync('git', args, { cwd, env: state.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim()
}
function assets(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    return item.isDirectory() ? assets(join(directory, item.name), path) : [path]
  }).filter(path => path !== 'README.md' && !path.includes('__pycache__') && !path.endsWith('.pyc'))
}
function verify(state, global, source = join(root, 'skills')) {
  const base = global ? state.home : state.cwd
  for (const agent of ['.agents', '.claude']) {
    for (const name of names) {
      for (const file of assets(join(source, name))) {
        const installed = join(base, agent, 'skills', name, file)
        assert.ok(existsSync(installed), `Missing ${installed}`)
        assert.deepEqual(readFileSync(installed), readFileSync(join(source, name, file)), `Changed ${name}/${file}`)
      }
    }
  }
}
function add(state, source, global, copy = true) {
  return run(state, ['add', source, ...(global ? ['--global'] : []), '--agent', 'claude-code', 'codex', '--skill', ...names, ...(copy ? ['--copy'] : []), '--yes'])
}
try {
  const local = environment('local')
  assert.equal(run(local, ['--version']).trim(), '1.7.2')
  const list = run(local, ['add', root, '--list'])
  for (const name of names) assert.ok(list.includes(name), `Discovery missed ${name}`)
  assert.match(list, /4 skills/)
  assert.ok(!existsSync(join(local.home, '.agents', 'skills')))
  add(local, root, false)
  verify(local, false)
  add(local, root, true)
  verify(local, true)
  for (const name of names) assert.ok(run(local, ['list', '--global']).includes(name))
  const linked = environment('symlink')
  add(linked, root, true, false)
  verify(linked, true)
  console.log('PASS: discovery and project/global installs for Claude Code and Codex, copy and default modes')

  // A genuine Git transport redirected to a local fixture through isolated Git
  // configuration. No mock CLI and no public fixture repo or remote writes.
  const update = environment('update')
  const origin = join(sandbox, 'origin.git')
  mkdirSync(origin)
  cpSync(join(root, 'skills'), join(origin, 'skills'), { recursive: true, filter: path => !path.includes('__pycache__') && !path.endsWith('.pyc') })
  git(update, origin, ['init', '-b', 'main'])
  git(update, origin, ['config', 'user.name', 'Ship CI fixture'])
  git(update, origin, ['config', 'user.email', 'fixture@example.invalid'])
  for (const name of names) writeFileSync(join(origin, 'skills', name, 'update-probe.txt'), 'revision-one\n')
  git(update, origin, ['add', 'skills'])
  git(update, origin, ['commit', '-m', 'fixture one'])
  const source = 'https://pre-ship-fixture.invalid/local/collection.git'
  const fileUrl = pathToFileURL(origin).href
  git(update, origin, ['config', '--global', `url.${fileUrl}.insteadOf`, source])
  git(update, origin, ['config', '--global', 'protocol.file.allow', 'always'])
  add(update, source, true)
  verify(update, true, join(origin, 'skills'))
  add(update, source, false)
  verify(update, false, join(origin, 'skills'))
  const lockFile = join(update.home, '.agents', '.skill-lock.json')
  const lockBefore = JSON.parse(readFileSync(lockFile, 'utf8'))
  for (const name of names) {
    assert.equal(lockBefore.skills[name].sourceType, 'git')
    assert.equal(lockBefore.skills[name].sourceUrl, source)
    assert.equal(lockBefore.skills[name].skillPath, `skills/${name}/SKILL.md`)
    assert.ok(lockBefore.skills[name].skillFolderHash)
  }
  const unrelated = join(update.home, '.agents', 'skills', 'local-only')
  mkdirSync(unrelated, { recursive: true })
  writeFileSync(join(unrelated, 'SKILL.md'), '---\nname: local-only\ndescription: Unrelated fixture\n---\nKeep this skill.\n')
  for (const name of names) writeFileSync(join(origin, 'skills', name, 'update-probe.txt'), 'revision-two\n')
  git(update, origin, ['add', 'skills'])
  git(update, origin, ['commit', '-m', 'fixture two'])
  run(update, ['update', 'ship', '--global', '--yes'])
  for (const agent of ['.agents', '.claude']) {
    assert.equal(readFileSync(join(update.home, agent, 'skills', 'ship', 'update-probe.txt'), 'utf8'), 'revision-two\n')
    assert.equal(readFileSync(join(update.home, agent, 'skills', 'pre-launch-checklist', 'update-probe.txt'), 'utf8'), 'revision-one\n')
  }
  run(update, ['update', ...names, '--global', '--yes'])
  verify(update, true, join(origin, 'skills'))
  const lockAfter = JSON.parse(readFileSync(lockFile, 'utf8'))
  for (const name of names) assert.notEqual(lockBefore.skills[name].skillFolderHash, lockAfter.skills[name].skillFolderHash)
  run(update, ['update', ...names, '--project', '--yes'])
  verify(update, false, join(origin, 'skills'))
  assert.ok(existsSync(join(update.cwd, 'skills-lock.json')))
  assert.match(readFileSync(join(unrelated, 'SKILL.md'), 'utf8'), /Keep this skill/)
  console.log('PASS: real Git-backed named updates refresh both agents in both scopes and preserve unrelated skills')
} catch (error) {
  if (error.stdout) logs.push({ failedStdout: error.stdout.toString() })
  if (error.stderr) logs.push({ failedStderr: error.stderr.toString() })
  console.error(JSON.stringify(logs, null, 2))
  throw error
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
