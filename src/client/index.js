/**
 * Browser half of dsh-git-branch-badge: the branch chip and its operation
 * popover, mounted at the LEFT end of the composer tool row (input card).
 * Registers into `conversation.input.left`, resolves the current session's
 * workspace folder through the standard `useWorkspaces` prop, and talks to
 * the host half through the /git-branch/api JSON route. Inline styles are
 * injected as one <style data-plugin> tag at activation and removed on fiber
 * disposal (the same convention the client bundle preset uses for CSS
 * modules).
 * @module dsh-git-branch-badge/client
 */

import { createElement, useEffect, useState } from 'react'

/** Services required before the badge can register. */
export const inject = ['slots']

/** CSS for the chip and popover; theme tokens only, with neutral fallbacks. */
const CSS = `
  .gb-root { position: relative; display: inline-flex; align-items: center; }
  .gb-chip {
    display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px;
    border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
    border-radius: 999px; background: var(--dsw-alias-bg-layer-1, #262a31);
    color: var(--dsw-alias-label-primary, #e6e6e6); font-size: 12px; line-height: 1;
    cursor: pointer; white-space: nowrap; font-family: inherit;
    transition: border-color .12s ease, background-color .12s ease;
  }
  .gb-chip:hover {
    border-color: var(--dsw-alias-border-l2, rgba(127,127,127,.55));
    background: var(--dsw-alias-bg-layer-2, #2d323a);
  }
  .gb-chip-icon { display: inline-flex; color: var(--dsw-alias-label-secondary, #8a8f98); }
  .gb-name { font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .gb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary, #d9a13b); flex: none; }
  .gb-pop {
    position: absolute; bottom: calc(100% + 8px); right: 0; z-index: 100;
    width: 280px; max-height: 384px; display: flex; flex-direction: column;
    border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
    border-radius: 10px; background: var(--dsw-alias-bg-overlay, #1f2329);
    color: var(--dsw-alias-label-primary, #e6e6e6);
    box-shadow: 0 8px 24px rgba(0,0,0,.18); overflow: hidden;
    animation: gb-pop-in .12s ease-out;
  }
  @keyframes gb-pop-in { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
  .gb-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px 4px; }
  .gb-title { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #8a8f98); }
  .gb-close {
    display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0;
    border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98); cursor: pointer;
  }
  .gb-close:hover { color: var(--dsw-alias-label-primary, #e6e6e6); background: rgba(127,127,127,.12); }
  .gb-new { display: flex; gap: 6px; padding: 6px 12px 8px; }
  .gb-input {
    flex: 1; min-width: 0; padding: 5px 8px;
    border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); border-radius: 6px;
    background: var(--dsw-alias-bg-layer-1, #262a31); color: var(--dsw-alias-label-primary, #e6e6e6);
    font-size: 12px; font-family: inherit;
  }
  .gb-input::placeholder { color: var(--dsw-alias-label-secondary, #8a8f98); }
  .gb-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #4c8dff); }
  .gb-btn {
    padding: 4px 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); border-radius: 6px;
    background: var(--dsw-alias-bg-layer-1, #262a31); color: var(--dsw-alias-label-primary, #e6e6e6);
    font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit;
  }
  .gb-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2, rgba(127,127,127,.55)); }
  .gb-btn:disabled { opacity: .45; cursor: default; }
  .gb-list { flex: 1; overflow-y: auto; padding: 2px 6px 8px; display: flex; flex-direction: column; gap: 1px; }
  .gb-list::-webkit-scrollbar { width: 8px; }
  .gb-list::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l2, rgba(127,127,127,.55)); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
  .gb-list::-webkit-scrollbar-track { background: transparent; }
  .gb-item {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px;
    color: var(--dsw-alias-label-primary, #e6e6e6); font-size: 12px; text-align: left;
    cursor: pointer; font-family: inherit; box-sizing: border-box;
  }
  .gb-item:hover { background: var(--dsw-alias-bg-layer-2, #2d323a); }
  .gb-item.gb-current { font-weight: 600; }
  .gb-item.gb-confirm-row { cursor: default; }
  .gb-item.gb-confirm-row:hover { background: transparent; }
  .gb-check { display: inline-flex; width: 14px; flex: none; color: var(--dsw-alias-brand-primary, #4c8dff); }
  .gb-row-op { margin-left: auto; display: inline-flex; gap: 2px; visibility: hidden; flex: none; }
  .gb-item:hover .gb-row-op { visibility: visible; }
  .gb-item.gb-confirm-row .gb-row-op { visibility: visible; }
  .gb-op {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0;
    border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98); cursor: pointer;
  }
  .gb-op:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #e6e6e6); background: rgba(127,127,127,.12); }
  .gb-op.gb-op-danger:hover:not(:disabled) { color: var(--dsw-alias-state-error-primary, #f06464); }
  .gb-op:disabled { opacity: .4; cursor: default; }
  .gb-confirm { color: var(--dsw-alias-state-warn-primary, #d9a13b); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gb-muted { color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 11px; padding: 4px 8px; }
  .gb-error { color: var(--dsw-alias-state-error-primary, #f06464); font-size: 11px; padding: 4px 8px; word-break: break-all; }
  .gb-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 8px 12px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
  }
  .gb-path {
    flex: 1; min-width: 0; font-size: 11px; color: var(--dsw-alias-label-secondary, #8a8f98);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .gb-icon-btn {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0;
    border: 0; border-radius: 5px; background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98); cursor: pointer; flex: none;
  }
  .gb-icon-btn:hover { color: var(--dsw-alias-label-primary, #e6e6e6); background: rgba(127,127,127,.12); }
  .gb-spin { animation: gb-spin .8s linear infinite; }
  @keyframes gb-spin { to { transform: rotate(360deg); } }
`

/** One POST to the host route; never throws. */
async function callApi(method, payload) {
  let res
  try {
    res = await fetch(`/git-branch/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  try {
    return await res.json()
  } catch {
    return { ok: false, error: `HTTP ${res.status}` }
  }
}

/** Stroke-based icon paths (lucide 24x24 vocabulary), rendered inline. */
const ICONS = {
  branch: [
    createElement('line', { key: 0, x1: 6, x2: 6, y1: 3, y2: 15 }),
    createElement('circle', { key: 1, cx: 18, cy: 6, r: 3 }),
    createElement('circle', { key: 2, cx: 6, cy: 18, r: 3 }),
    createElement('path', { key: 3, d: 'M18 9a9 9 0 0 1-9 9' }),
  ],
  check: [createElement('path', { key: 0, d: 'M20 6 9 17l-5-5' })],
  pen: [
    createElement('path', { key: 0, d: 'M12 20h9' }),
    createElement('path', { key: 1, d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }),
  ],
  trash: [
    createElement('path', { key: 0, d: 'M3 6h18' }),
    createElement('path', { key: 1, d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    createElement('path', { key: 2, d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }),
    createElement('line', { key: 3, x1: 10, x2: 10, y1: 11, y2: 17 }),
    createElement('line', { key: 4, x1: 14, x2: 14, y1: 11, y2: 17 }),
  ],
  refresh: [
    createElement('path', { key: 0, d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }),
    createElement('path', { key: 1, d: 'M21 3v5h-5' }),
    createElement('path', { key: 2, d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }),
    createElement('path', { key: 3, d: 'M8 16H3v5' }),
  ],
  close: [
    createElement('path', { key: 0, d: 'M18 6 6 18' }),
    createElement('path', { key: 1, d: 'm6 6 12 12' }),
  ],
}

/** One inline SVG icon. */
function Icon({ name, size = 14 }) {
  return createElement('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }, ICONS[name] ?? [])
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

/** Extract the error string from a wire envelope, else the fallback. */
function errorOf(result, fallback) {
  return result !== null && typeof result === 'object' && typeof result.error === 'string'
    ? result.error
    : fallback
}

/** Normalize a git-info wire result into component state. */
function parseInfo(result) {
  if (result === null || typeof result !== 'object' || result.ok !== true) {
    return { phase: 'error', message: errorOf(result, '查询失败') }
  }
  if (result.notGit === true) return { phase: 'notGit' }
  return {
    phase: 'ready',
    current: typeof result.current === 'string' && result.current !== '' ? result.current : null,
    branches: Array.isArray(result.branches) ? result.branches : [],
    dirty: result.dirty === true,
  }
}

/**
 * The composer chip + branch operation popover.
 * @param props - conversation.input.left standard props (useWorkspaces, sessionId).
 * @returns the badge element tree, or null for ungrouped sessions.
 */
function GitBranchBadge(props) {
  const [state, setState] = useState({ phase: 'loading' })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const [newName, setNewName] = useState('')
  const [rowAction, setRowAction] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const workspaces = props.useWorkspaces((s) => s.items)
  const workspace = workspaces.find((w) => w.sessionIds.includes(props.sessionId))
  const workspacePath = workspace === undefined ? undefined : workspace.path

  useEffect(() => {
    if (workspacePath === undefined) return
    let cancelled = false
    setState({ phase: 'loading' })
    setNotice(null)
    callApi('info', { path: workspacePath }).then((result) => {
      if (!cancelled) setState(parseInfo(result))
    })
    return () => { cancelled = true }
  }, [workspacePath])

  if (workspace === undefined) return null

  const reload = () => {
    setState({ phase: 'loading' })
    setNotice(null)
    callApi('info', { path: workspacePath }).then((result) => {
      setState(parseInfo(result))
    })
  }

  const switchBranch = (branch) => {
    if (busy !== null || state.phase !== 'ready') return
    setBusy(branch)
    setNotice(null)
    callApi('checkout', { path: workspacePath, branch }).then((result) => {
      setBusy(null)
      if (result !== null && typeof result === 'object' && result.ok === true) {
        setOpen(false)
        reload()
        return
      }
      setNotice(errorOf(result, '切换失败'))
    })
  }

  const createBranch = () => {
    const name = newName.trim()
    if (busy !== null || !validBranchName(name)) return
    setBusy('create')
    setNotice(null)
    callApi('create', { path: workspacePath, name }).then((result) => {
      setBusy(null)
      if (result !== null && typeof result === 'object' && result.ok === true) {
        setNewName('')
        setNotice('已创建并切换到 ' + name)
        reload()
        return
      }
      setNotice(errorOf(result, '创建失败'))
    })
  }

  const renameBranch = (branch) => {
    const name = renameDraft.trim()
    if (busy !== null || !validBranchName(name)) return
    setBusy(branch)
    setNotice(null)
    callApi('rename', { path: workspacePath, branch, name }).then((result) => {
      setBusy(null)
      if (result !== null && typeof result === 'object' && result.ok === true) {
        setRowAction(null)
        setNotice('已重命名 ' + branch + ' → ' + name)
        reload()
        return
      }
      setNotice(errorOf(result, '重命名失败'))
    })
  }

  const deleteBranch = (branch) => {
    if (busy !== null) return
    setBusy(branch)
    setNotice(null)
    callApi('delete', { path: workspacePath, branch }).then((result) => {
      setBusy(null)
      if (result !== null && typeof result === 'object' && result.ok === true) {
        setRowAction(null)
        setNotice('已删除分支 ' + branch)
        reload()
        return
      }
      setNotice(errorOf(result, '删除失败'))
    })
  }

  const cancelRowAction = () => {
    if (busy !== null) return
    setRowAction(null)
  }

  const startRename = (branch) => {
    if (busy !== null) return
    setRowAction({ branch, mode: 'rename' })
    setRenameDraft(branch)
    setNotice(null)
  }

  const startDelete = (branch) => {
    if (busy !== null) return
    setRowAction({ branch, mode: 'delete' })
    setNotice(null)
  }

  const chipLabel = state.phase === 'ready'
    ? (state.current ?? 'detached')
    : state.phase === 'loading' ? '' : state.phase === 'notGit' ? '非 Git' : '!'
  const chipTitle = state.phase === 'ready'
    ? (state.dirty
      ? workspacePath + '（当前分支 ' + (state.current ?? 'detached') + '，有未提交修改）'
      : workspacePath + '（当前分支 ' + (state.current ?? 'detached') + '）')
    : state.phase === 'notGit' ? workspacePath + '（不是 Git 仓库）' : workspacePath

  const chip = createElement('button', {
    type: 'button',
    className: 'gb-chip',
    title: chipTitle,
    'aria-label': 'Git 分支',
    onClick: () => { setOpen((v) => !v) },
  }, [
    createElement('span', {
      key: 'i',
      className: state.phase === 'loading' ? 'gb-chip-icon gb-spin' : 'gb-chip-icon',
    }, createElement(Icon, { name: 'branch', size: 13 })),
    chipLabel !== '' && createElement('span', { key: 'n', className: 'gb-name' }, chipLabel),
    state.phase === 'ready' && state.dirty === true
      ? createElement('span', { key: 'd', className: 'gb-dot', title: '有未提交修改' })
      : null,
  ])

  if (!open) return createElement('div', { className: 'gb-root' }, chip)

  const head = createElement('div', { className: 'gb-head' }, [
    createElement('span', { key: 't', className: 'gb-title' }, '分支'),
    createElement('button', {
      key: 'x', type: 'button', className: 'gb-close', 'aria-label': '关闭',
      onClick: () => { setOpen(false) },
    }, createElement(Icon, { name: 'close', size: 12 })),
  ])

  let body
  if (state.phase === 'error') {
    body = createElement('div', { className: 'gb-error' }, String(state.message))
  } else if (state.phase === 'notGit') {
    body = createElement('div', { className: 'gb-muted' }, '该文件夹不是 Git 仓库')
  } else if (state.phase === 'loading') {
    body = createElement('div', { className: 'gb-muted' }, '读取中…')
  } else {
    const items = state.branches.map((branch) => {
      const current = branch === state.current
      const isBusy = busy === branch
      if (rowAction !== null && rowAction.branch === branch && rowAction.mode === 'rename') {
        return createElement('div', { key: branch, className: 'gb-item gb-confirm-row' }, [
          createElement('input', {
            key: 'i', className: 'gb-input', value: renameDraft, autoFocus: true,
            onChange: (e) => { setRenameDraft(e.target.value) },
            onKeyDown: (e) => {
              if (e.key === 'Enter') { e.preventDefault(); renameBranch(branch) }
              else if (e.key === 'Escape') cancelRowAction()
            },
          }),
          createElement('button', {
            key: 'ok', type: 'button', className: 'gb-btn',
            disabled: isBusy || !validBranchName(renameDraft.trim()),
            onClick: () => { renameBranch(branch) },
          }, isBusy ? '…' : '确定'),
          createElement('button', { key: 'no', type: 'button', className: 'gb-btn', disabled: isBusy, onClick: cancelRowAction }, '取消'),
        ])
      }
      if (rowAction !== null && rowAction.branch === branch && rowAction.mode === 'delete') {
        return createElement('div', { key: branch, className: 'gb-item gb-confirm-row' }, [
          createElement('span', { key: 't', className: 'gb-confirm' }, '删除分支 ' + branch + '？'),
          createElement('span', { key: 'ops', className: 'gb-row-op' }, [
            createElement('button', { key: 'ok', type: 'button', className: 'gb-op gb-op-danger', disabled: isBusy, onClick: () => { deleteBranch(branch) } }, isBusy ? '…' : '删除'),
            createElement('button', { key: 'no', type: 'button', className: 'gb-op', disabled: isBusy, onClick: cancelRowAction }, '取消'),
          ]),
        ])
      }
      return createElement('div', {
        key: branch,
        role: 'button',
        tabIndex: 0,
        className: current ? 'gb-item gb-current' : 'gb-item',
        onClick: () => { switchBranch(branch) },
        onKeyDown: (e) => { if (e.key === 'Enter') switchBranch(branch) },
      }, [
        createElement('span', { key: 'c', className: 'gb-check' }, current ? createElement(Icon, { name: 'check', size: 12 }) : null),
        createElement('span', { key: 'b' }, branch),
        busy === branch
          ? createElement('span', { key: 'w', className: 'gb-muted gb-spin' }, createElement(Icon, { name: 'refresh', size: 12 }))
          : null,
        createElement('span', { key: 'ops', className: 'gb-row-op', onClick: (e) => { e.stopPropagation() } }, [
          createElement('button', {
            key: 'rn', type: 'button', className: 'gb-op', title: '重命名',
            disabled: busy !== null, onClick: () => { startRename(branch) },
          }, createElement(Icon, { name: 'pen', size: 12 })),
          createElement('button', {
            key: 'dl', type: 'button', className: 'gb-op gb-op-danger', title: '删除',
            disabled: busy !== null || current, onClick: () => { startDelete(branch) },
          }, createElement(Icon, { name: 'trash', size: 12 })),
        ]),
      ])
    })
    const extra = []
    if (state.current === null) extra.push(createElement('div', { key: 'det', className: 'gb-muted' }, 'HEAD 处于游离状态'))
    if (notice !== null) extra.push(createElement('div', { key: 'err', className: 'gb-error' }, notice))
    body = createElement('div', { className: 'gb-list' }, [...items, ...extra])
  }

  const newRow = createElement('div', { className: 'gb-new' }, [
    createElement('input', {
      key: 'i', className: 'gb-input', placeholder: '新分支名，回车创建并切换', value: newName,
      onChange: (e) => { setNewName(e.target.value) },
      onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); createBranch() } },
    }),
    createElement('button', {
      key: 'b', type: 'button', className: 'gb-btn',
      disabled: busy !== null || !validBranchName(newName.trim()),
      onClick: createBranch,
    }, busy === 'create' ? '…' : '新建'),
  ])

  const foot = createElement('div', { className: 'gb-foot' }, [
    createElement('span', { key: 'p', className: 'gb-path', title: workspacePath }, workspacePath),
    createElement('button', {
      key: 'r', type: 'button', className: 'gb-icon-btn', title: '刷新', onClick: reload,
    }, createElement(Icon, { name: 'refresh', size: 12 })),
  ])

  const pop = createElement('div', { className: 'gb-pop' }, [head, newRow, body, foot])

  return createElement('div', { className: 'gb-root' }, [chip, pop])
}

/**
 * Client plugin body: inject the stylesheet and register the composer badge.
 * @param ctx - client cordis context (slots).
 */
export function apply(ctx) {
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-git-branch-badge'
    tag.dataset.pluginCss = 'dsh-git-branch-badge/styles'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'dsh-git-branch-badge: styles')

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'git-branch',
    order: 30,
    label: 'Git 分支',
  }, GitBranchBadge))
}
