# dsh-git-branch-badge

DSH Web UI 分支徽标插件：在**会话头部**显示当前工作区文件夹的 git 分支，支持查看、切换、新建、重命名、删除分支。

| 徽标 | 说明 |
| --- | --- |
| `⎇ master` | 当前会话所属工作区文件夹的 git 分支 |
| 黄色圆点 | 该文件夹有未提交的修改 |

## 功能

| 操作 | 用法 | 底层命令 |
| --- | --- | --- |
| 查看分支 | 徽标显示当前分支 + 未提交修改圆点 | `git rev-parse` / `git status --porcelain` |
| 切换分支 | 点击分支列表中的行（当前分支带 ✓） | `git switch <branch>` |
| 新建分支 | 面板顶部输入框，回车或点"新建" | `git switch -c <name>`（创建并切换） |
| 重命名分支 | 行尾 ✎ → 内联输入，回车确认 / Esc 取消 | `git branch -m <old> <new>` |
| 删除分支 | 行尾 🗑 → 二次确认 | `git branch -d <branch>`（安全删除） |
| 刷新 | 面板底部"刷新"按钮 | 重新读取全部信息 |

安全说明：删除只用 `-d`（未合并分支会被 git 拒绝并显示原因），当前分支不可删除；任何操作失败都会把 git 的原始报错显示在面板里。

## 快速使用（约 1 分钟）

> 前置条件：本机已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`），并且能用 `dsh web` 打开 Web 界面。

**第 1 步：下载定义文件**

```bash
curl -L -o ~/git-branch-badge.dsh-plugin.json \
  https://raw.githubusercontent.com/ChenYichener/dsh-git-branch-badge/main/git-branch-badge.dsh-plugin.json
```

**第 2 步：在 DSH 会话里安装**

打开任意一个 DSH 会话，把下面这段话发给你的 agent：

> 读取 ~/git-branch-badge.dsh-plugin.json 文件，用文件里的内容（plugin / name / purpose / code 字段）调用 cordis_define 定义这个插件，然后 cordis_run 运行它。

**第 3 步：批准激活**

界面会话流里出现 `cordis_run` 卡片时，点击 **允许 / Allow**。

完成 —— 会话头部（天气小部件旁边）出现 `⎇ 分支名` 徽标，点击即可操作分支。

## 使用说明

- 徽标绑定**当前会话所属的工作区文件夹**（按 `sessionId → workspace.sessionIds → workspace.path` 解析）；不属于任何工作区的散装会话不显示。
- 点击徽标弹出分支面板：
  - **顶部输入框**：输入新分支名创建并切换；
  - **分支列表**：点击行切换；行尾 ✎ 重命名；行尾 🗑 删除（需确认）；
  - **底部"刷新"**：重新读取分支信息。
- 非 Git 文件夹显示"非 Git"占位；游离 HEAD 有提示。
- 分支名有基础校验（空白、`..`、`-` 开头等非法字符会被拦截），git 仍是最终裁决者。

## 更新

### 使用者：升级到最新版

动态插件**不持久化**：重启 `dsh` 后失效。"更新"和"重装"是同一个动作——重新执行上面三步（重新下载 JSON → 重新定义运行 → 重新批准）即可拿到最新功能。

### 维护者：发布新版本

1. 修改 `src/host.js`（Host 半边，git 命令执行）或 `src/client.js`（Client 半边，徽标 UI）；
2. 重新生成分发文件：`node scripts/build.js`（从 `src/*.js` 打包出 `git-branch-badge.dsh-plugin.json`）；
3. 提交推送：

```bash
git add -A && git commit -m "describe the change" && git push
```

使用者重新 curl 下载 JSON 并重装即完成升级。

## 卸载

在 DSH 会话里让 agent 执行：

- `cordis_stop` —— 暂停插件（定义保留，可随时重新运行）；
- `cordis_undefine` —— 彻底删除插件。

## 常见问题

**Q：重启 dsh 后徽标不见了？**
A：正常。动态插件只存在于当前进程，重启后重新执行"快速使用"三步即可。

**Q：想一劳永逸、重启不丢？**
A：把功能做成正式插件（`dsh plugin add` 可安装的 bundle，像 dsh-better-sidebar 那样），或合入 deepseek-harness 上游。目前这是维护者视角的后续路线，有需要可以联系仓库维护者。

**Q：Windows 上能用吗？**
A：能。依赖的 `subprocess` 服务和 `conversation.session.header.utilities` 槽位都是标准 profile 自带；git 命令均为跨平台子命令。

## 技术说明

- 这是**动态 Cordis 插件**：Host 半边用 `harness.handle` 暴露私有 RPC（`git-info` / `git-checkout` / `git-create-branch` / `git-delete-branch` / `git-rename-branch`），通过 `subprocess` 服务直接执行 git（不经 shell、不受沙箱写权限限制）；Client 半边注册进 `conversation.session.header.utilities` 槽位，样式全部使用 DSH 主题 token。
- 仓库结构：

```
dsh-git-branch-badge/
  README.md
  LICENSE
  git-branch-badge.dsh-plugin.json   # 分发产物（安装用）
  src/host.js                        # Host 半边源码（可编辑）
  src/client.js                      # Client 半边源码（可编辑）
  scripts/build.js                   # 由 src/*.js 重新生成分发 JSON
```

## License

[MIT](LICENSE)
