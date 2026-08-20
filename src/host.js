return {
  apply(ctx) {
    const subprocess = ctx.get('subprocess')

    let gitExe = 'git'
    if (subprocess !== undefined) {
      void subprocess.resolveExecutable('git')
        .then((path) => { gitExe = path })
        .catch(() => {})
    }

    // Run one git command in `cwd`, collect stdout/stderr, return plain JSON facts.
    async function runGit(cwd, args) {
      if (subprocess === undefined) return { error: 'subprocess 服务不可用' }
      let handle
      try {
        handle = subprocess.spawn({
          argv: [gitExe, ...args],
          cwd,
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: 64 * 1024 },
            stderr: { maxBytes: 64 * 1024 },
          },
          graceMs: 3000,
        })
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
      let outcome
      try {
        outcome = await handle.done
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
      const stdout = (handle.collected.stdout?.readFrom(0).text ?? '').trim()
      const stderr = (handle.collected.stderr?.readFrom(0).text ?? '').trim()
      return { exitCode: outcome.exitCode, stdout, stderr }
    }

    function readString(args, key) {
      return args !== null && typeof args === 'object' && typeof args[key] === 'string' ? args[key] : ''
    }

    // Mirror git's check-ref-format constraints closely enough to stop junk
    // names before they reach git; git stays the final arbiter.
    function validBranchName(name) {
      if (name === '' || name === '.' || name === '..') return false
      if (/[\s~^:?*[\\]/.test(name)) return false
      if (name.includes('..') || name.includes('//') || name.includes('@{')) return false
      if (name.startsWith('-')) return false
      if (name.endsWith('/') || name.endsWith('.')) return false
      return true
    }

    function mapResult(result) {
      if (result.error !== undefined) return { ok: false, error: result.error }
      if (result.exitCode !== 0) return { ok: false, error: result.stderr !== '' ? result.stderr : 'git 命令失败' }
      return { ok: true }
    }

    ctx.effect(() => harness.handle('git-info', async (args) => {
      const path = readString(args, 'path')
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
    }))

    ctx.effect(() => harness.handle('git-checkout', async (args) => {
      const path = readString(args, 'path')
      const branch = readString(args, 'branch')
      if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
      return mapResult(await runGit(path, ['switch', branch]))
    }))

    ctx.effect(() => harness.handle('git-create-branch', async (args) => {
      const path = readString(args, 'path')
      const name = readString(args, 'name')
      if (path === '') return { ok: false, error: '缺少文件夹路径' }
      if (!validBranchName(name)) return { ok: false, error: '分支名不合法' }
      return mapResult(await runGit(path, ['switch', '-c', name]))
    }))

    ctx.effect(() => harness.handle('git-delete-branch', async (args) => {
      const path = readString(args, 'path')
      const branch = readString(args, 'branch')
      if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
      return mapResult(await runGit(path, ['branch', '-d', branch]))
    }))

    ctx.effect(() => harness.handle('git-rename-branch', async (args) => {
      const path = readString(args, 'path')
      const branch = readString(args, 'branch')
      const name = readString(args, 'name')
      if (path === '' || branch === '') return { ok: false, error: '缺少参数' }
      if (!validBranchName(name)) return { ok: false, error: '分支名不合法' }
      return mapResult(await runGit(path, ['branch', '-m', branch, name]))
    }))
  },
}
