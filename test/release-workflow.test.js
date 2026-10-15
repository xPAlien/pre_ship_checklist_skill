const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const workflow = readFileSync(join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8')

// Guards the publish path. CLAUDE.md: no publish without repository-owner approval.
test('release workflow publishes only through OIDC after owner approval and checks', () => {
  assert.match(workflow, /tags: \['v\*\.\*\.\*'\]/)
  assert.match(workflow, /^\s+environment: npm-publish$/m)
  assert.match(workflow, /^\s+id-token: write$/m)
  assert.ok(!/NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./.test(workflow), 'no stored npm token')
  assert.ok(!/contents: write/.test(workflow))
  assert.ok(!/pull_request|workflow_dispatch/.test(workflow), 'tag push is the only trigger')
  for (const step of ['does not match package.json', 'not on master', 'already published', 'npm test', 'unittest discover -s test/python', '--fail-on secret', 'verify:package']) {
    assert.ok(workflow.includes(step), step)
  }
  assert.ok(workflow.indexOf('verify:package') < workflow.indexOf('npm publish'), 'checks run before publish')
  for (const line of workflow.split('\n').filter(l => /uses: /.test(l))) assert.match(line, /@[0-9a-f]{40} #/, line)
  const npmPin = workflow.match(/npm@(\d+)\.(\d+)\.(\d+)/)
  assert.ok(npmPin, 'exact npm version pinned')
  const [major, minor, patch] = npmPin.slice(1).map(Number)
  assert.ok(major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1))), 'npm 11.5.1+ for trusted publishing')
})
