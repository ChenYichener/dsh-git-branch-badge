/**
 * Browser half of dsh-git-branch-badge: the session-header branch chip and
 * its operation popover. Registers into `conversation.session.header.utilities`
 * (right-aligned session utilities, next to the weather chip), resolves the
 * current session's workspace folder through the standard `useWorkspaces`
 * prop, and talks to the host half through the /git-branch/api JSON route.
 * Inline styles are injected as one <style data-plugin> tag at activation and
 * removed on fiber disposal (the same convention the client bundle preset
 * uses for CSS modules).
 * @module dsh-git-branch-badge/client
 */

import { createElement, useEffect, useState } from 'react'

/** Services required before the badge can register. */
export const inject = ['slots']

/** CSS for the chip and popover; theme tokens only, with neutral fallbacks. */
const CSS = `
  .gb-root { position: relative; display: inline-flex; align-items: center; }
  .gb-chip {
    display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px;
    border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
    background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98);
    font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit;
  }
  .gb-chip:hover { color: var(--dsw-alias-label-primary, #e6e6e6); }
  .gb-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .gb-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary, #d9a13b); }
  .gb-pop {
    position: absolute; top: calc(100% + 6px); right: 0; z-index: 100;
    min-width: 220px; max-width: 300px; max-height: 360px; overflow: auto;
    background: var(--dsw-alias-bg-overlay, #1f2329);
    border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.5));
    border-radius: 8px; padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.35);
    display: flex; flex-direction: column; gap: 2px;
  }
  .gb-new { display: flex; gap: 4px; padding: 2px 2px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); }
  .gb-input {
    flex: 1; min-width: 0; background: transparent;
    border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
    border-radius: 6px; color: var(--dsw-alias-label-primary, #e6e6e6);
    font-size: 12px; padding: 3px 6px; font-family: inherit;
  }
  .gb-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #4c8dff); }
  .gb-btn {
    border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35)); background: transparent;
    color: var(--dsw-alias-label-secondary, #8a8f98); border-radius: 6px;
    font-size: 11px; padding: 2px 8px; cursor: pointer; font-family: inherit; white-space: nowrap;
  }
  .gb-btn:hover { color: var(--dsw-alias-label-primary, #e6e6e6); }
  .gb-btn:disabled { opacity: .4; cursor: default; }
  .gb-item {
    display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px;
    border: 0; border-radius: 6px; background: transparent;
    color: var(--dsw-alias-label-primary, #e6e6e6); font-size: 12px; text-align: left;
    cursor: pointer; font-family: inherit; box-sizing: border-box;
  }
  .gb-item:hover { background: rgba(127,127,127,.14); }
  .gb-item.gb-current { font-weight: 600; }
  .gb-item.gb-confirm-row { cursor: default; }
  .gb-item.gb-confirm-row:hover { background: transparent; }
  .gb-check { color: var(--dsw-alias-brand-primary, #4c8dff); width: 12px; flex: none; }
  .gb-row-op { margin-left: auto; display: inline-flex; gap: 2px; visibility: hidden; flex: none; }
  .gb-item:hover .gb-row-op { visibility: visible; }
  .gb-item.gb-confirm-row .gb-row-op { visibility: visible; }
  .gb-op {
    border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98);
    cursor: pointer; font-size: 11px; padding: 0 3px; font-family: inherit;
  }
  .gb-op:hover { color: var(--dsw-alias-label-primary, #e6e6e6); }
  .gb-op:disabled { opacity: .4; cursor: default; }
  .gb-confirm { color: var(--dsw-alias-state-warn-primary, #d9a13b); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gb-muted { color: var(--dsw-alias-label-secondary, #8a8f98); font-size: 11px; padding: 2px 8px; }
  .gb-error { color: var(--dsw-alias-state-error-primary, #f06464); font-size: 11px; padding: 2px 8px; word-break: break-all; }
  .gb-foot {
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    margin-top: 4px; padding: 4px 8px 2px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.35));
  }
  .gb-foot .gb-muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gb-refresh {
    border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #8a8f98);
    font-size: 11px; cursor: pointer; padding: 2px 4px; font-family: inherit;
  }
  .gb-refresh:hover { color: var(--dsw-alias-label-primary, #e6e6e6); }
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
 * The header chip + branch operation popover.
 * @param props - conversation.session.header.utilities standard props
 * (useWorkspaces, sessionId).
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
    : state.phase === 'loading' ? '…' : state.phase === 'notGit' ? '非 Git' : '!'
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
    createElement('span', { key: 'g' }, '⎇'),
    createElement('span', { key: 'n', className: 'gb-name' }, chipLabel),
    state.phase === 'ready' && state.dirty === true
      ? createElement('span', { key: 'd', className: 'gb-dot', title: '有未提交修改' })
      : null,
  ])

  if (!open) return createElement('div', { className: 'gb-root' }, chip)

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
            createElement('button', { key: 'ok', type: 'button', className: 'gb-op', disabled: isBusy, onClick: () => { deleteBranch(branch) } }, isBusy ? '…' : '删除'),
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
        createElement('span', { key: 'c', className: 'gb-check' }, current ? '✓' : ''),
        createElement('span', { key: 'b' }, branch),
        busy === branch ? createElement('span', { key: 'w', className: 'gb-muted' }, '…') : null,
        createElement('span', { key: 'ops', className: 'gb-row-op', onClick: (e) => { e.stopPropagation() } }, [
          createElement('button', { key: 'rn', type: 'button', className: 'gb-op', title: '重命名', disabled: busy !== null, onClick: () => { startRename(branch) } }, '✎'),
          createElement('button', { key: 'dl', type: 'button', className: 'gb-op', title: '删除', disabled: busy !== null || current, onClick: () => { startDelete(branch) } }, '🗑'),
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

  const footer = createElement('div', { className: 'gb-foot' }, [
    createElement('span', { key: 'p', className: 'gb-muted' }, workspacePath),
    createElement('button', { key: 'r', type: 'button', className: 'gb-refresh', onClick: reload }, '刷新'),
  ])

  const pop = createElement('div', { className: 'gb-pop' }, [newRow, body, footer])

  return createElement('div', { className: 'gb-root' }, [chip, pop])
}

/**
 * Client plugin body: inject the stylesheet and register the header badge.
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

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'git-branch',
    order: 30,
    label: 'Git 分支',
  }, GitBranchBadge))
}
