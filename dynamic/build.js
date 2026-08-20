#!/usr/bin/env node
/**
 * Assemble the distribution artifact git-branch-badge.dsh-plugin.json from
 * the editable sources src/host.js and src/client.js.
 * Run from the repo root: node scripts/build.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const host = readFileSync(join(root, 'src', 'host.js'), 'utf8')
const client = readFileSync(join(root, 'src', 'client.js'), 'utf8')
const payload = {
  name: 'git-branch-badge',
  purpose: '在当前 Web UI 会话头部显示当前工作区文件夹的 git 分支徽标，支持查看、切换、新建、重命名和删除分支。',
  plugin: { kind: 'new', idPrefix: 'gitbr' },
  code: { host, client },
}
const out = join(root, 'git-branch-badge.dsh-plugin.json')
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n')
console.log(`wrote ${out} (host ${host.length}B, client ${client.length}B)`)
