const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..')
const read = path => readFileSync(join(root, path), 'utf8')
const controls = read('skills/ship/references/backend-controls.md')
const protocol = read('skills/ship/references/backend-review.md')
const skill = read('skills/ship/SKILL.md')
const report = read('skills/ship/templates/ship-report.md')

// These tests check the distributed review contract, not application security.
function controlRows(text) {
  return text.split('\n').filter(line => /^\| BE-\d{2} \|/.test(line))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
}

function validateControlInventory(text) {
  const rows = controlRows(text)
  const expected = Array.from({ length: 25 }, (_, i) => `BE-${String(i + 1).padStart(2, '0')}`)
  assert.deepEqual(rows.map(row => row[0]), expected, 'Every source item needs one ordered control')
  for (const row of rows) {
    assert.equal(row.length, 4)
    assert.ok(row[1].length > 5 && row[3].length > 80, row[0])
  }
  return rows
}

test('backend inventory contains 25 mapped controls in the five source groups', () => {
  validateControlInventory(controls)
  const groups = controls.split(/^## \d\. /m).slice(1)
  assert.equal(groups.length, 5)
  assert.deepEqual(groups.map(group => controlRows(group).length), [6, 4, 5, 5, 5])
})

test('inventory validation rejects dropped, duplicate, and empty requirements', () => {
  const row = controls.split('\n').find(line => line.startsWith('| BE-11 |'))
  assert.throws(() => validateControlInventory(controls.replace(row + '\n', '')))
  assert.throws(() => validateControlInventory(controls.replace('BE-12 |', 'BE-11 |')))
  assert.throws(() => validateControlInventory(controls.replace(row, '| BE-11 | Webhook | G1-08 | |')))
})

test('all backend mappings point to existing gate checks', () => {
  const ids = new Set([...read('skills/ship/references/checklist.md').matchAll(/^\| (G[0-7]-\d{2}) \|/gm)].map(m => m[1]))
  for (const [id, , targets] of controlRows(controls)) {
    const refs = targets.split(', ')
    assert.ok(refs.length > 0, id)
    for (const ref of refs) assert.ok(ids.has(ref), `${id} references missing ${ref}`)
  }
})

test('primary source references are complete and use HTTPS', () => {
  const definitions = [...controls.matchAll(/^\[(S\d+)\]: (https:\/\/\S+)$/gm)]
  const keys = definitions.map(m => m[1])
  assert.equal(new Set(keys).size, keys.length)
  const body = controls.split('## Primary documentation')[0]
  const uses = [...body.matchAll(/\[(S\d+)\]/g)].map(m => m[1])
  assert.ok(uses.length > 15)
  for (const key of uses) assert.ok(keys.includes(key), key)
  for (const key of keys) assert.ok(uses.includes(key), `Unused reference ${key}`)
})

test('review groups partition every backend control without overlap', () => {
  const ranges = [...protocol.matchAll(/\| BE-(\d{2}) through BE-(\d{2}) \|/g)]
  assert.equal(ranges.length, 5)
  const ids = ranges.flatMap(m => Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i))
  assert.deepEqual(ids, Array.from({ length: 25 }, (_, i) => i + 1))
  assert.match(protocol, /execute the same groups sequentially/)
  assert.match(protocol, /Do not claim independent review or five subagents unless they ran/)
})

test('main workflow loads the supplement and preserves mutation boundaries', () => {
  assert.match(skill, /Read `references\/backend-controls.md` and `references\/backend-review.md` on every audit/)
  for (const required of [
    'Show the complete findings and proposed edits before making fixes',
    'Stop for explicit approval of the named scope',
    'one designated writer',
    'Do not rewrite Git history',
    'Never request a secret value',
    'sandbox or test-mode credentials',
    'Stop when mode or account identity is unknown',
    'Do not export production customer data',
    'separate owner-action table'
  ]) assert.ok(protocol.includes(required), required)
  assert.match(skill, /Unknown budgets, grace periods, retention, or critical provider settings remain owner decisions/)
})

test('payment and operations evidence includes failure cases and qualifications', () => {
  const rows = new Map(controlRows(controls).map(row => [row[0], row[3]]))
  const checks = {
    'BE-03': ['actual runtime role', 'BYPASSRLS'],
    'BE-07': ['Distinguish alerts from enforced caps', 'Never invent'],
    'BE-11': ['raw body', 'invalid signatures', 'wrong environment'],
    'BE-12': ['concurrent', 'out-of-order', 'crash', 'durable acceptance'],
    'BE-15': ['paid-through', 'grace periods', 'missed-event', 'late events'],
    'BE-17': ['Daily backups are not a universal target', 'disposable non-production'],
    'BE-18': ['missed-run', 'missing heartbeat'],
    'BE-20': ['existing sessions', 'Real-account suspension requires separate approval'],
    'BE-21': ['exact account/record IDs', 'Names or email patterns are not proof'],
    'BE-25': ['No blanket upgrade', 'Scanner failure is not a clean result']
  }
  for (const [id, required] of Object.entries(checks)) {
    for (const text of required) assert.ok(rows.get(id).includes(text), `${id}: ${text}`)
  }
})

test('original source mapping and report requirements remain present', () => {
  const original = read('skills/ship/references/source-mapping.md')
  assert.equal([...original.matchAll(/^\| \d+ \|/gm)].length, 40)
  assert.match(controls, /65 items, not 65 unique security controls/)
  for (const required of ['BE-01 through BE-25', 'Owner actions and business decisions', 'Fixture provenance', 'Separate approval', 'Production changes performed', 'NEEDS VERIFICATION']) {
    assert.ok(report.includes(required), required)
  }
})

test('package, lockfile, skill and versioned documentation agree', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.ok(skill.includes(`version: "${pkg.version}"`))
  assert.ok(read('README.md').includes(`v${pkg.version}`))
  assert.ok(read('skills/ship/README.md').includes(`Version ${pkg.version}`))
  assert.ok(controls.includes(`v${pkg.version}`))
})
