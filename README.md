# dsh-git-branch-badge

DSH Web UI 分支徽标插件：在**会话头部**显示当前工作区文件夹的 git 分支，支持查看、切换、新建、重命名、删除分支。

| 徽标 | 说明 |
| --- | --- |
| `⎇ master` | 当前会话所属工作区文件夹的 git 分支 |
| 黄色圆点 | 该文件夹有未提交的修改 |

安装后**重启即生效、常驻不丢**（不再依赖动态插件，`dsh` 升级/重启后依然在）。

## 安装（一行命令）

> 前置条件：本机已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）。

```bash
# 方式一：从 npm 安装（推荐，已发布为免费公开包）
dsh plugin --profile <你的profile名> add dsh-git-branch-badge@0.1.0

# 方式二：直接从本仓库安装（无需 npm 账号）
dsh plugin --profile <你的profile名> add github:ChenYichener/dsh-git-branch-badge
```

然后**重启 `dsh web`**，会话头部（天气小部件旁边）出现 `⎇ 分支名` 徽标即安装成功。

> 默认 profile 一般是 `web`（即 `dsh web` 用的那个）；不确定可以运行 `dsh plugin --profile web list` 查看。

## 功能

| 操作 | 用法 | 底层命令 |
| --- | --- | --- |
| 查看分支 | 徽标显示当前分支 + 未提交修改圆点 | `git rev-parse` / `git status --porcelain` |
| 切换分支 | 点击分支列表中的行（当前分支带 ✓） | `git switch <branch>` |
| 新建分支 | 面板顶部输入框，回车或点"新建" | `git switch -c <name>`（创建并切换） |
| 重命名分支 | 行尾 ✎ → 内联输入，回车确认 / Esc 取消 | `git branch -m <old> <new>` |
| 删除分支 | 行尾 🗑 → 二次确认 | `git branch -d <branch>`（安全删除） |
| 刷新 | 面板底部"刷新"按钮 | 重新读取全部信息 |

安全说明：删除只用 `-d`（未合并分支会被 git 拒绝并显示原因），当前分支不可删除；任何操作失败都会把 git 的原始报错显示在面板里；所有 git 命令都不经过 shell，分支名有 `check-ref-format` 规则校验。

## 使用说明

- 徽标绑定**当前会话所属的工作区文件夹**；不属于任何工作区的散装会话不显示。
- 点击徽标弹出分支面板：顶部输入框新建；列表点击行切换、行尾 ✎ 重命名、行尾 🗑 删除（需确认）；底部"刷新"。
- 非 Git 文件夹显示"非 Git"占位；游离 HEAD 有提示。

## 更新

### 使用者：升级到新版

```bash
dsh plugin --profile <profile名> add dsh-git-branch-badge@<新版本号>
# 或（GitHub 渠道）
dsh plugin --profile <profile名> add github:ChenYichener/dsh-git-branch-badge
```

然后重启 `dsh web`。

### 维护者：发布新版本

1. 修改 `src/index.js`（Host 半边：git 命令与路由）或 `src/client/index.js`（Client 半边：徽标 UI）；
2. 重新构建客户端包：`npm run build`（tsdown 生成 `lib/client.js`，已提交，用户从 git 安装无需构建）；
3. 跑一遍冒烟测试（见 `scripts/smoke.mjs`，用临时仓库验证全部操作）；
4. 提交推送（`git push`）；使用者重新执行上面的 add 命令 + 重启即升级。

## 卸载

```bash
dsh plugin --profile <profile名> remove dsh-git-branch-badge
```

然后重启 `dsh web`。

## 常见问题

**Q：安装后徽标没出现？**
A：确认重启了 `dsh web`；确认当前会话属于某个工作区（散装会话不显示）；查看是否报错（重启后的启动日志）。

**Q：和动态插件版（`dynamic/` 目录）什么关系？**
A：`dynamic/` 是早期用动态 Cordis 插件机制做的版本（重启即失效，需要反复重装），已被本 bundle 取代。bundle 版用正式插件机制（Host webServer 路由 + Client slots），装一次常驻。

## 技术说明

- **Host 半边**（`src/index.js`）：挂载 `/git-branch/api` JSON 路由（`ctx.webServer.register`），用 `node:child_process` 直接执行 git（不经 shell），带 DNS-rebinding / 跨站请求防护（仅接受 loopback Host + 同源浏览器标记）。
- **Client 半边**（`src/client/index.js`）：注册进 `conversation.session.header.utilities` 槽位，通过 `fetch` 调宿主路由；样式为内联 `<style data-plugin>` 注入，全部使用 DSH 主题 token。
- 构建：tsdown 生成 `lib/client.js`（`window.__ModuleLoader__.load` 模块表格式，react 走外部模块表），Node 半边即源文件，无需构建。
- 仓库结构：

```
dsh-git-branch-badge/
  README.md
  LICENSE
  package.json            # dsh.bundle.patch + dsh.client 清单
  cordis.patch.yml        # bundle 补丁：插入插件行
  tsdown.config.ts        # client bundle 构建配置
  src/index.js            # Host 半边（路由 + git）
  src/client/index.js     # Client 半边（徽标 UI）
  lib/client.js           # 构建产物（已提交）
  scripts/smoke.mjs       # Host 半边集成冒烟测试
  dynamic/                # 旧动态插件版（保留备查）
```

## License

[MIT](LICENSE)
