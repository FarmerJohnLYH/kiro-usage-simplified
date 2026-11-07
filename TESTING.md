# Test record / 测试记录

Verified / 验证日期：2026-11-08（Asia/Shanghai，UTC+8）。

## Result / 结果

- **120 / 120** automated unit and child-process tests passed for 0.1.1; no skipped tests. / 0.1.1 的 120 项单元及真实子进程测试全部通过，无跳过项。
- `src/` coverage: **100% lines, 96.69% branches, 97.14% functions**. These percentages exclude the VS Code entrypoint, test runners and packaging scripts. / 覆盖率仅统计核心模块，不把入口及测试、打包脚本计入分母。
- 0.1.1 adds regression checks that pending refreshes preserve the current usage/error text, severity color, tooltip and accessibility label. / 0.1.1 新增回归检查：刷新期间保留当前用量或错误提示，以及颜色、悬停说明和无障碍标签。
- Baseline 0.1.0 extension-host scenarios passed on Windows x64 with **VS Code 1.85.2 / Node 18.15.0** and **VS Code 1.111.0 / Node 22.22.0**. / 0.1.0 基线已通过两个真实 VS Code 版本的宿主场景。
- The 0.1.0 VSIX passed missing-CLI verification on 1.85.2. The 0.1.1 VSIX passed live-usage verification on 1.111.0 with **Kiro CLI 3.1.0**. / 0.1.0 安装包通过最低版本缺失 CLI 测试；0.1.1 安装包通过当前版本真实用量测试。
- The real CLI returned supported usage without requiring another sign-in during this run. No raw response, token or account identity was stored in fixtures or this record. / 本次真实调用无需再次登录，未把原始响应、令牌或账号身份写入测试样例和本记录。
- `npm audit` and `npm audit --omit=dev`: **0 vulnerabilities** at verification time. / 全量及运行时依赖审计均为 0 项漏洞。
- Publisher / 发布者：`YuanhaoLiu`; extension ID / 扩展 ID：`YuanhaoLiu.kiro-usage-simplified`。
- Release artifacts and SHA-256 checksums are attached to GitHub Releases. / 发布包及 SHA-256 校验文件见 GitHub Releases 附件。

## Coverage matrix / 覆盖矩阵

| Area / 范围 | Cases / 场景 | Evidence / 验证方式 |
| --- | --- | --- |
| Parsing / 解析 | Inline percent, next-line progress bar, missing percent, ANSI/OSC, CRLF, whitespace, decimals, thousands separators / 行内及下一行百分比、缺省百分比、控制码、换行、小数、千分位 | `test/usage.test.js` |
| Numeric boundaries / 数值边界 | Zero usage, zero quota, >100%, 59.99/60/90/90.01, negative/NaN/Infinity, malformed grouping, unsafe integers, overflow / 零用量、零额度、超额和阈值、非法数值 | `test/usage.test.js` |
| Ambiguity / 歧义 | Empty output, unrelated output, bonus-only output, duplicate plan lines / 空内容、无关内容、仅奖励额度、重复套餐行 | `test/usage.test.js` |
| CLI absent / 本地无 CLI | Actual ENOENT, status indication, useful tooltip, quiet background retry, recovery after path correction / 实际缺失进程、提示、无弹窗重试、修复路径后恢复 | Unit + real process + both hosts + installed VSIX / 单元、真实进程、双版本宿主和安装包 |
| Process handling / 进程处理 | Fixed arguments, shell disabled, home cwd, inherited env, stdin EOF, nonzero exit, output >1 MiB, timeout, abort before/during request / 固定参数、无 shell、主目录、环境继承、EOF、异常退出、超大输出、超时和取消 | Actual child processes / 真实子进程 |
| Error classification / 错误分类 | Missing/permission/auth/timeout/format/incompatible/output/config/general; auth on stdout with zero exit / 缺失、权限、认证、超时、格式、不兼容、输出、配置、通用错误及退出码为零的认证失败 | Unit + synthetic subprocesses / 单元及模拟 CLI 进程 |
| Executable selection / 路径 | Paths containing spaces, home expansion, bad relative/quoted paths, Windows wrappers; workspace executable override ignored / 空格、主目录展开、非法相对或引号路径、Windows 包装脚本、忽略工作区路径覆盖 | Unit + real host fixture executable / 单元及宿主可执行文件 |
| Settings / 设置 | Defaults, 0/1/4/5.8/86401, negative/string/NaN/Infinity/null; timeout bounds; live changes / 默认值、禁用与截断、非法类型、超时边界和实时变更 | Unit + hosts / 单元及宿主 |
| Polling / 轮询 | Startup, manual-only, completion-based delay, one active request, simultaneous clicks, no duplicate error notifications / 启动、仅手动、完成后计时、单请求、连点和通知去重 | Unit + hosts / 单元及宿主 |
| Recovery / 恢复 | Failure after success is stale; last success time retained; next success clears errors; path change drops old account values / 失败标旧、保留成功时间、恢复清错、换路径清缓存 | Unit + hosts / 单元及宿主 |
| Lifecycle / 生命周期 | Abort on settings change and disposal; ignore late success/rejection; dispose timers, commands, output, UI; repeated start/dispose / 设置变化及退出取消、丢弃过期结果、释放资源、幂等启停 | `test/controller.test.js` |
| Trust / 信任 | No CLI execution while untrusted; granting trust starts refresh; executable restricted to machine settings / 未信任不执行、信任后启动、路径仅来自机器设置 | Mocked VS Code API + manifest assertions / 模拟 API 与清单检查 |
| Privacy / 隐私 | Diagnostic logs omit raw output, account data and injected test secret / 日志不包含原始输出、账号或测试密钥 | Assertions on status, notifications and output / 状态、通知和输出断言 |
| Packaging / 打包 | Allowlisted contents; runtime bytes match source; installed extension loaded from extensions directory, not development checkout / 白名单、运行代码字节一致、实际加载安装目录 | VSIX archive inspection + `test:package` / 归档检查和安装包测试 |
| Publisher migration / 发布者迁移 | `local` and `YuanhaoLiu` packages cannot both register identical commands/settings / 旧本地预览与正式 ID 共存产生重复注册 | Reproduced in an isolated profile; documented uninstall; test profiles now separated by publisher / 已复现并记录卸载步骤，测试配置按发布者隔离 |

## Reproduce / 复现

Development environment used / 本次开发环境：Windows x64, Node.js 24.19.0, npm 11.17.0。

```sh
npm ci
npm run check
npm test
npm run test:coverage
npm run test:integration
npm run release:check
npm run package:list
npm run package
npm run test:package
npm audit
```

On Windows PowerShell, use `npm.cmd` if `.ps1` execution is blocked. / PowerShell 拦截 `.ps1` 时使用 `npm.cmd`。

Use `VSCODE_TEST_VERSION=1.85.2` for the minimum-version host, or `VSCODE_EXECUTABLE_PATH` for an installed binary. / 最低版本通过 `VSCODE_TEST_VERSION=1.85.2` 指定，也可通过 `VSCODE_EXECUTABLE_PATH` 选择本机程序。

`test:package` defaults to a nonexistent CLI path. Set `KIRO_USAGE_LIVE_CLI` to an actual executable only when intentionally testing your current authenticated account. It performs one startup request with polling disabled. / 安装包测试默认验证不存在的 CLI；主动验收真实账号时才设置 `KIRO_USAGE_LIVE_CLI`。真实模式关闭自动轮询，仅执行一次启动请求。

Tests use `.vscode-test/` for downloaded editors, synthetic executables and isolated profiles. It is gitignored and excluded from VSIX. / 测试产物和独立配置均放在 `.vscode-test/`，不进入 Git 或 VSIX。

## Limits and release state / 限制与发布状态

- macOS, Linux, ARM64, WSL/SSH/containers and other CLI versions/accounts/plans have **not** been verified on actual hosts. / 这些平台及其他版本、账号、套餐未经本次实机验证。
- Authentication failures and expiry are simulated; the real CLI was already able to return usage. No sign-out was performed to force a failure. / 认证失败和过期采用模拟场景；没有主动退出真实账号。
- Restricted Mode is tested at controller/manifest level; the integration runners use trusted isolated profiles. / 受限模式验证限于控制器和清单层，集成测试使用可信独立配置。
- Status text and background colors are asserted via API; this is not a pixel-level visual audit across themes, DPI levels or screen readers. / 状态文本和颜色通过 API 断言，未逐像素验收所有主题、缩放和读屏器。
- There is no guarantee that future CLI output will retain this format. Unsupported formats produce a clear error instead of a fabricated quota. / 后续 CLI 格式可能变化，不兼容时明确报错。
- Public source: https://github.com/FarmerJohnLYH/kiro-usage-simplified. / 公开源码使用独立仓库。
- This record covers local build and installation verification; publication status is shown by GitHub Releases and the Marketplace listing. / 本记录描述本地构建与安装验收，发布状态以 GitHub Releases 和市场页面为准。
