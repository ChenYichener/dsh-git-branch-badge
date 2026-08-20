/**
 * Node half of dsh-git-branch-badge: a /git-branch/api JSON route on the host
 * webServer. Every method runs one `git -C <path>` command through
 * node:child_process (never shell-interpreted), returns porcelain-parsed
 * facts, and mirrors git's check-ref-format rules for branch names before
 * they reach git. The route is fenced against cross-site / DNS-rebinding
 * requests (loopback Host header + browser markers), the same posture as the
 * dsh-better-sidebar routes.
 * @module dsh-git-branch-badge
 */

import { spawn } from 'node:child_process'

/** Service required before the route can mount. */
export const inject = ['webServer']

/** One JSON request body bound (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20
/** Per-stream stdout/stderr capture cap per git run. */
const MAX_OUTPUT_BYTES = 64 * 1024

/** Run one git command in `cwd`; resolves plain JSON facts, never rejects. */
function runGit(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString('utf8')
    })
    // Resolve only at process close: stream 'end' can fire before the exit
    // code is known, and git success messages arrive on stderr.
    child.on('close', (exitCode, signal) => {
      resolve({ exitCode, signal, stdout: stdout.trim(), stderr: stderr.trim() })
    })
    child.on('error', (error) => { resolve({ error: error.message }) })
  })
}

/** Narrow an unknown payload value to a string, else ''. */
function readString(payload, key) {
  return payload !== null && typeof payload === 'object' && typeof payload[key] === 'string'
    ? payload[key]
    : ''
}

/** Mirror git's check-ref-format constraints; git stays the final arbiter. */
function validBranchName(name) {
  if (name === '' || name === '.' || name === '..') return false
  if (/[\s~^:?*[\\]/.test(name)) return false
  if (name.includes('..') || name.includes('//') || name.includes('@{')) return false
  if (name.startsWith('-')) return false
  if (name.endsWith('/') || name.endsWith('.')) return false
  return true
}

/** Map one runGit outcome to the wire envelope. */
function mapResult(result) {
  if (result.error !== undefined) return { ok: false, error: result.error }
  if (result.exitCode !== 0) return { ok: false, error: result.stderr !== '' ? result.stderr : 'git 命令失败' }
  return { ok: true }
}

/** git-info: current branch, local branch list, dirty flag. */
async function cmdInfo(payload) {
  const path = readString(payload, 'path')
  if (path === '') return { ok: false, error: '缺少文件夹路径' }
  const [current, branches, status] = await Promise.all([
    runGit(path, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(path, ['branch', '--format=%(refname:short)']),
    runGit(path, ['status', '--porcelain']),
  ])
  if (current.error !== undefined) return { ok: false, error: current.error }
  if (current.exitCode !== 0) return { ok: true, notGit: true }
  const currentBranch = current.stdout === '' || current.stdout === 'HEAD' ? null : current.stdout
  const branchList = branches.stdout === '' ? [] : branches.stdout.split('\n')
  const dirty = status.exitCode === 0 && status.stdout !== ''
  return { ok: true, current: currentBranch, branches: branchList, dirty }
}

/** git-checkout: switch to an existing branch. */
async function cmdCheckout(payload) {
  const path = readString(payload, 'path')
  const branch = readString(payload, 'branch')
  if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
  return mapResult(await runGit(path, ['switch', branch]))
}

/** git-create-branch: create AND switch (git switch -c). */
async function cmdCreate(payload) {
  const path = readString(payload, 'path')
  const name = readString(payload, 'name')
  if (path === '') return { ok: false, error: '缺少文件夹路径' }
  if (!validBranchName(name)) return { ok: false, error: '分支名不合法' }
  return mapResult(await runGit(path, ['switch', '-c', name]))
}

/** git-delete-branch: safe delete (git branch -d, refuses unmerged). */
async function cmdDelete(payload) {
  const path = readString(payload, 'path')
  const branch = readString(payload, 'branch')
  if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
  return mapResult(await runGit(path, ['branch', '-d', branch]))
}

/** git-rename-branch: rename any local branch (git branch -m old new). */
async function cmdRename(payload) {
  const path = readString(payload, 'path')
  const branch = readString(payload, 'branch')
  const name = readString(payload, 'name')
  if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
  if (!validBranchName(name)) return { ok: false, error: '分支名不合法' }
  return mapResult(await runGit(path, ['branch', '-m', branch, name]))
}

/** Method dispatch table. */
const METHODS = {
  info: cmdInfo,
  checkout: cmdCheckout,
  create: cmdCreate,
  delete: cmdDelete,
  rename: cmdRename,
}

/** Parse and bound a JSON request body. */
async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

/** Loopback hostname check (localhost, [::1], 127.*). */
function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Cross-site / DNS-rebinding fence: loopback Host header + browser markers. */
function isTrusted(req) {
  const host = req.headers.host
  if (typeof host !== 'string') return false
  let hostname
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostname)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Write a JSON response. */
function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** Route handler: fence, POST-only, dispatch by URL tail. */
async function handleApi(req, res) {
  if (!isTrusted(req)) {
    writeJson(res, 403, { ok: false, error: 'forbidden' })
    return
  }
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
  const method = pathname.startsWith('/git-branch/api/') ? pathname.slice('/git-branch/api/'.length) : undefined
  const handler = method !== undefined && !method.includes('/') ? METHODS[method] : undefined
  if (handler === undefined) {
    writeJson(res, 404, { ok: false, error: 'unknown git-branch API method' })
    return
  }
  try {
    const payload = await readJsonBody(req)
    writeJson(res, 200, await handler(payload))
  } catch (error) {
    writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Plugin body: mount the /git-branch/api route under the host webServer.
 * @param ctx - host cordis context (webServer).
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/git-branch/api',
    handler: handleApi,
  }), 'dsh-git-branch-badge: /git-branch/api routes')
}
