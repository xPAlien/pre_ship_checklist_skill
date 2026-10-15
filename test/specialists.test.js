const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const root = join(__dirname, '..')
const read = path => readFileSync(join(root, path), 'utf8')

// Original item counts, blocker lists, and fast-mode progress must agree (CLAUDE.md standard 3).
for (const [name, total] of [['pre-launch-checklist', 25], ['vibe-coder-security-checklist', 36]]) {
  test(`${name} keeps ${total} numbered items and consistent blocker counts`, () => {
    const source = read(`skills/${name}/SKILL.md`)
    const items = [...source.matchAll(/^ {0,1}(\d+)\. \*\*\[(BLOCKER|WARNING)\]/gm)]
    assert.deepEqual(items.map(m => Number(m[1])), Array.from({ length: total }, (_, i) => i + 1))
    const blockers = items.filter(m => m[2] === 'BLOCKER').map(m => Number(m[1]))
    const listed = source.match(/^Blockers: items (.+)$/m)[1].split(', ').map(Number)
    assert.deepEqual(listed, blockers, 'Blockers line matches [BLOCKER] items')
    assert.match(source, new RegExp(`(\\d+) baseline blocker items`))
    assert.equal(Number(source.match(/(\d+) baseline blocker items/)[1]), blockers.length)
    assert.match(source, new RegExp(`X of ${total} evaluated" or "X of ${blockers.length} evaluated" in fast mode`))
    assert.ok(!/within 30 days/.test(source), 'No universal 30-day deadline')
  })
}

test('ai-code-review keeps 45 stable CR items and consistent counts', () => {
  const checklist = read('skills/ai-code-review/references/checklist.md')
  const ids = [...checklist.matchAll(/^\| (\d)\.(\d+) \|/gm)].map(m => `${m[1]}.${m[2]}`)
  const expected = [[1, 5], [2, 7], [3, 10], [4, 8], [5, 5], [6, 5], [7, 5]].flatMap(([d, n]) => Array.from({ length: n }, (_, i) => `${d}.${i + 1}`))
  assert.deepEqual(ids, expected)
  const skill = read('skills/ai-code-review/SKILL.md')
  assert.match(skill, /all 45 items/)
  assert.match(skill, /`CR-1\.1` to `CR-7\.5`/)
  assert.match(skill, /NEEDS VERIFICATION/)
  assert.match(skill, /read-only review/)
  assert.match(checklist, /only to idempotent operations or requests carrying an idempotency key/)
  assert.ok(!/Never use wildcard in production/.test(read('skills/ai-code-review/references/common-failures.md')))
  assert.ok(!/AI never adds rate limiting/.test(checklist + read('skills/ai-code-review/references/common-failures.md')))
  for (const ref of [...read('skills/ai-code-review/references/common-failures.md').matchAll(/\(CR-(\d\.\d+)\)/g)].map(m => m[1])) assert.ok(ids.includes(ref), ref)
  assert.match(read('skills/ship/SKILL.md'), /`\.\.\/ai-code-review\/SKILL\.md`/)
})

test('specialists defer release decisions to ship and keep audit boundaries', () => {
  for (const name of ['pre-launch-checklist', 'vibe-coder-security-checklist', 'ai-code-review']) {
    const source = read(`skills/${name}/SKILL.md`)
    const description = source.match(/^description: "(.+)"$/m)[1]
    assert.match(description, /use the ship skill/)
    assert.ok(!/trigger proactively/i.test(description), `${name} must not compete with ship for general launch prompts`)
  }
  const security = read('skills/vibe-coder-security-checklist/SKILL.md')
  assert.ok(!/purge it with `git filter-repo`/.test(security))
  assert.match(security, /never an audit step, and never a substitute for rotation/)
  assert.ok(!/Vercel \(use a release command\)/.test(read('skills/pre-launch-checklist/SKILL.md')))
})

test('ship cites specialist items by stable IDs and loads backend controls conditionally', () => {
  const skill = read('skills/ship/SKILL.md')
  assert.match(skill, /`PL-NN`/)
  assert.match(skill, /`SEC-NN`/)
  assert.match(skill, /\$\{CLAUDE_SKILL_DIR\}\/scripts\/preflight\.py/)
  assert.match(read('skills/ship/references/source-mapping.md'), /`PL-01` to `PL-25`.+`SEC-01` to `SEC-36`/)
  const schema = JSON.parse(read('skills/ship/templates/ship-report.schema.json'))
  const pattern = new RegExp(schema.properties.findings.items.properties.controls.items.pattern)
  for (const id of ['G6-12', 'BE-25', 'PL-07', 'SEC-27', 'CR-2.3', 'CR-3.10', 'V9']) assert.ok(pattern.test(id), id)
  for (const id of ['CR-8.1', 'CR-2', 'CR-x.y']) assert.ok(!pattern.test(id), id)
})

test('new Vercel controls exist with stable IDs', () => {
  const checklist = read('skills/ship/references/checklist.md')
  for (const id of ['G6-12', 'G7-10', 'G7-11']) assert.match(checklist, new RegExp(`^\\| ${id} \\|`, 'm'))
  const vercel = read('skills/ship/references/vercel.md')
  for (const text of ['CRON_SECRET', 'Rolling Releases', 'Skew Protection', 'Protection Bypass for Automation', 'Allowed in `audit` mode', 'Forbidden without separate explicit authorization']) {
    assert.ok(vercel.includes(text), text)
  }
})
