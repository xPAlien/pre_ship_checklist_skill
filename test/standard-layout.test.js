const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')
const root = join(__dirname, '..')
const names = ['ai-code-review', 'pre-launch-checklist', 'ship', 'vibe-coder-security-checklist']
const cli = join(root, 'bin', 'pre-ship-checklist-skill.js')

test('exactly four standard folders with matching frontmatter and no flat duplicates', () => {
  assert.deepEqual(readdirSync(join(root, 'skills')).sort(), names)
  for (const name of names) {
    const source = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8')
    assert.ok(source.startsWith('---\n'))
    assert.match(source, new RegExp(`^name: ${name}$`, 'm'))
    assert.match(source, /^description: .+/m)
    assert.ok(!existsSync(join(root, `${name}.skill`)))
  }
  assert.ok(!existsSync(join(root, 'ship')))
})

test('compatibility installer refuses Skills CLI copy ownership even with force', () => {
  const home = mkdtempSync(join(tmpdir(), 'ship-manager-test-'))
  const work = join(home, 'work')
  mkdirSync(work)
  const env = { ...process.env, HOME: home, USERPROFILE: home }
  delete env.CODEX_SKILLS_DIR
  delete env.CLAUDE_SKILLS_DIR
  try {
    const path = join(home, '.agents', 'skills', 'ship')
    mkdirSync(path, { recursive: true })
    writeFileSync(join(path, 'SKILL.md'), 'keep owner content')
    writeFileSync(join(home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { ship: { source: 'xPAlien/pre_ship_checklist_skill' } } }))
    assert.throws(() => execFileSync(process.execPath, [cli, 'install', '--agent', 'codex', '--only', 'ship', '--force'], { env, cwd: work, stdio: 'pipe' }), error => {
      assert.match(error.stderr.toString(), /Skills CLI owns/)
      return true
    })
    assert.equal(readFileSync(join(path, 'SKILL.md'), 'utf8'), 'keep owner content')
  } finally { rmSync(home, { recursive: true, force: true }) }
})

test('compatibility installer refuses a manager-owned link without touching its target', () => {
  const home = mkdtempSync(join(tmpdir(), 'ship-link-test-'))
  try {
    const target = join(home, 'target')
    const managed = join(home, 'managed')
    mkdirSync(target)
    mkdirSync(managed)
    writeFileSync(join(managed, 'SKILL.md'), 'keep linked content')
    symlinkSync(managed, join(target, 'ship'), process.platform === 'win32' ? 'junction' : 'dir')
    assert.throws(() => execFileSync(process.execPath, [cli, 'install', '--only', 'ship', '--target', target, '--force'], { stdio: 'pipe' }), error => {
      assert.match(error.stderr.toString(), /symlink-managed/)
      return true
    })
    assert.equal(readFileSync(join(managed, 'SKILL.md'), 'utf8'), 'keep linked content')
  } finally { rmSync(home, { recursive: true, force: true }) }
})

test('installation docs pin CLI version and do not broaden named updates', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  const migration = readFileSync(join(root, 'docs', 'skills-cli-migration.md'), 'utf8')
  assert.match(readme, /skills@1\.7\.2 add/)
  assert.match(readme, /update ship pre-launch-checklist vibe-coder-security-checklist ai-code-review --global/)
  assert.match(migration, /backup outside all agent skill-discovery directories/)
  assert.match(migration, /Do not use two managers|After migration, stop using the legacy installer/)
})
