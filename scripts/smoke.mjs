#!/usr/bin/env node
/**
 * Host-half integration smoke test: mount src/index.js with a fake cordis
 * ctx, drive the real /git-branch/api handler with fake http req/res, and
 * exercise every method against a scratch repo it creates in /tmp.
 * Run from the repo root: node scripts/smoke.mjs
 */
import { rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { apply } from '../src/index.js'

const scratch = '/tmp/gitbb-smoke-repo'
rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })
execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: scratch })
writeFileSync(`${scratch}/a.txt`, 'hi\n')
execFileSync('git', ['add', 'a.txt'], { cwd: scratch })
execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], { cwd: scratch })
execFileSync('git', ['branch', 'dev'], { cwd: scratch })

let captured = null
const ctx = {
  effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {} },
  webServer: {
    register: (route) => { captured = route; return () => {} },
  },
}
apply(ctx)
if (captured === null || captured.kind !== 'prefix' || captured.path !== '/git-branch/api') {
  throw new Error('route not registered: ' + JSON.stringify(captured))
}

async function post(method, payload, headers = {}) {
  const req = {
    method: 'POST',
    url: `/git-branch/api/${method}`,
    headers: { host: '127.0.0.1:3080', 'content-type': 'application/json', ...headers },
    [Symbol.asyncIterator]: async function* () { yield Buffer.from(JSON.stringify(payload)) },
  }
  let status = 0
  let body = ''
  const res = {
    writeHead: (s) => { status = s },
    end: (b) => { body = b },
  }
  await captured.handler(req, res)
  return { status, body: JSON.parse(body) }
}

const results = {}
results.info = await post('info', { path: scratch })
results.notGit = await post('info', { path: '/tmp/nonexistent-dir' })
results.fence = await post('info', { path: scratch }, { host: 'evil.example.com' })
results.method = await post('unknown', { path: scratch })
results.getDenied = await (async () => {
  const req = { method: 'GET', url: '/git-branch/api/info', headers: { host: '127.0.0.1:3080' } }
  let status = 0
  const res = { writeHead: (s) => { status = s }, end: () => {} }
  await captured.handler(req, res)
  return status
})()
results.create = await post('create', { path: scratch, name: 'feat-smoke' })
results.infoAfterCreate = await post('info', { path: scratch })
results.rename = await post('rename', { path: scratch, branch: 'feat-smoke', name: 'feat-renamed' })
results.checkout = await post('checkout', { path: scratch, branch: 'master' })
results.delete = await post('delete', { path: scratch, branch: 'feat-renamed' })
results.badName = await post('create', { path: scratch, name: 'bad name' })
results.deleteCurrent = await post('delete', { path: scratch, branch: 'master' })

const assert = (cond, label) => {
  if (cond) console.log('PASS:', label)
  else { console.error('FAIL:', label, JSON.stringify(results)); process.exitCode = 1 }
}
assert(results.info.body.ok === true && results.info.body.current === 'master'
  && results.info.body.branches.includes('dev') && results.info.body.dirty === false, 'info on git repo')
assert(results.notGit.body.ok === true && results.notGit.body.notGit === true, 'non-git dir reports notGit')
assert(results.fence.status === 403, 'cross-site host fenced')
assert(results.method.status === 404, 'unknown method 404')
assert(results.getDenied === 405, 'GET refused')
assert(results.create.body.ok === true, 'create branch')
assert(results.infoAfterCreate.body.current === 'feat-smoke', 'created branch is current')
assert(results.rename.body.ok === true, 'rename branch')
assert(results.checkout.body.ok === true, 'checkout back to master')
assert(results.delete.body.ok === true, 'delete merged branch')
assert(results.badName.body.ok === false, 'invalid name rejected')
assert(results.deleteCurrent.body.ok === false, 'delete current branch refused')

if (process.exitCode === undefined) console.log('\nall smoke assertions passed')
