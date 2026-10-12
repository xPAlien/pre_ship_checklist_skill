const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const root = join(__dirname, '..')
if (!process.env.npm_execpath) throw new Error('Run through npm run verify:package')
const raw = execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' })
const [pkg] = JSON.parse(raw)
const files = new Set(pkg.files.map(file => file.path))
function walk(directory, prefix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}/${entry.name}`
    return entry.isDirectory() ? walk(join(directory, entry.name), relative) : [relative]
  })
}
const expected = walk(join(root, 'skills'), 'skills').filter(path => !path.includes('__pycache__') && !path.endsWith('.pyc'))
for (const path of expected) assert.ok(files.has(path), `Missing packaged source: ${path}`)
assert.ok(files.has('LICENSE'))
assert.ok(files.has('docs/skills-cli-migration.md'))
assert.ok(![...files].some(path => path.startsWith('ship/') || path.endsWith('.skill')))
assert.ok(![...files].some(path => path.includes('__pycache__') || path.endsWith('.pyc')))
const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.version, metadata.version)
console.log(`Package verified: ${files.size} files, ${expected.length} standard skill assets, version ${pkg.version}`)
