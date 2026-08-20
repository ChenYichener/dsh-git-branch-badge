# dsh-git-branch-badge

A DSH Web UI plugin that shows the git branch of the current workspace folder as a chip at the **left end of the composer tool row**, with view, switch, create, rename and delete operations.

| Badge | Meaning |
| --- | --- |
| `⎇ main` | The git branch of the current session's workspace folder |
| Yellow dot | The folder has uncommitted changes |

Installed as a regular plugin bundle: **it survives `dsh` restarts and upgrades** — no dynamic-plugin re-install needed.

[中文文档](README.zh.md)

## Install (one command)

> Prerequisite: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) installed.

```bash
# npm channel (recommended, published as a free public package)
dsh plugin --profile <profile-name> add dsh-git-branch-badge@0.1.0

# or install straight from this repository (no npm account needed)
dsh plugin --profile <profile-name> add github:ChenYichener/dsh-git-branch-badge
```

Then **restart `dsh web`**. The `⎇ <branch>` chip appears at the left end of the composer tool row; clicking it opens the branch panel upward.

> The default profile is usually `web` (the one `dsh web` uses). Run `dsh plugin --profile web list` if unsure.

## Features

| Operation | How | Underlying command |
| --- | --- | --- |
| View branch | Chip shows the current branch + an uncommitted-changes dot | `git rev-parse` / `git status --porcelain` |
| Switch branch | Click a row (current branch is marked ✓) | `git switch <branch>` |
| Create branch | Type in the top input, press Enter or click "New" | `git switch -c <name>` (creates and switches) |
| Rename branch | Row-end ✎ → inline input, Enter to confirm / Esc to cancel | `git branch -m <old> <new>` |
| Delete branch | Row-end 🗑 → confirm | `git branch -d <branch>` (safe delete) |
| Refresh | "Refresh" button at the bottom of the panel | re-reads everything |

Safety notes: deletion only uses `-d` (unmerged branches are refused by git with the reason shown), the current branch cannot be deleted, and every failure surfaces git's original error inside the panel. All git commands run without a shell, and branch names are validated against the `check-ref-format` rules before reaching git.

## Usage

- The badge follows **the current session's workspace folder**; sessions that belong to no workspace show nothing.
- Click the chip to open the panel (it opens upward from the composer):
  - the top input creates a branch (and switches to it);
  - rows switch on click; row-end ✎ renames; row-end 🗑 deletes (with confirmation);
  - the bottom "Refresh" re-reads the branch list.
- Non-git folders show a "Non-Git" placeholder; a detached HEAD is called out.

## Update

### Users: upgrade to a new version

```bash
dsh plugin --profile <profile-name> add dsh-git-branch-badge@<new-version>
# or (GitHub channel)
dsh plugin --profile <profile-name> add github:ChenYichener/dsh-git-branch-badge
```

Then restart `dsh web`.

### Maintainers: publish a new version

1. Edit `src/index.js` (host half: git commands + route) or `src/client/index.js` (client half: badge UI);
2. Rebuild the client bundle: `npm run build` (tsdown emits `lib/client.js`, which is committed so git installs need no build);
3. Run the smoke test (`node scripts/smoke.mjs`, exercises every operation on a scratch repo);
4. `npm version patch && npm publish`, then `git push`; users re-run the add command above and restart.

## Uninstall

```bash
dsh plugin --profile <profile-name> remove dsh-git-branch-badge
```

Then restart `dsh web`.

## FAQ

**Q: The badge does not appear after install?**
A: Make sure you restarted `dsh web`, and that the current session belongs to a workspace (ungrouped sessions show nothing). Check the startup log for errors.

**Q: What about the old dynamic-plugin version (`dynamic/`)?**
A: `dynamic/` is the early implementation built on the dynamic Cordis plugin mechanism (lost on every restart, required re-install). It has been replaced by this bundle, which uses the regular plugin mechanism (host webServer route + client slots) and persists.

## How it works

- **Host half** (`src/index.js`): mounts the `/git-branch/api` JSON route (`ctx.webServer.register`), runs git through `node:child_process` (never shell-interpreted), and is fenced against DNS-rebinding / cross-site requests (loopback Host header + same-origin browser markers only).
- **Client half** (`src/client/index.js`): registers into the `conversation.input.left` slot, calls the host route via `fetch`; styles are injected as an inline `<style data-plugin>` tag using DSH theme tokens.
- **Build**: tsdown emits `lib/client.js` in the module-loader format (`window.__ModuleLoader__.load`, react resolved from the module table); the Node half is plain source, no build.

```
dsh-git-branch-badge/
  README.md              # English (default)
  README.zh.md           # 中文
  LICENSE
  package.json           # dsh.bundle.patch + dsh.client manifest
  cordis.patch.yml       # bundle patch: inserts the plugin row
  tsdown.config.ts       # client bundle build config
  src/index.js           # host half (route + git)
  src/client/index.js    # client half (badge UI)
  lib/client.js          # build output (committed)
  scripts/smoke.mjs      # host-half integration smoke test
  dynamic/               # legacy dynamic-plugin version (kept for reference)
```

## License

[MIT](LICENSE)
