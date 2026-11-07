# Kiro Usage (Simplified)

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=YuanhaoLiu.kiro-usage-simplified) · [Issues / 问题反馈](https://github.com/FarmerJohnLYH/kiro-usage-simplified/issues)

```text
🟢 25.5/100 · 25.5%
```

## 中文

在 VS Code 状态栏查看 Kiro 额度用量。

1. 安装并登录 [Kiro CLI](https://kiro.dev/docs/getting-started/installation/)，确保所在环境能运行 `kiro-cli`。
2. 安装本扩展，右侧状态栏会自动显示用量；点击即可刷新，也可运行 **Kiro Usage: Refresh**。
3. 若显示 **CLI not found**，在 **Kiro Usage: Open Settings** 中设置 CLI 绝对路径；Windows 使用 `.exe`。修改 PATH 后需重启 VS Code。

🟢 <60% · 🟡 60–90% · 🔴 >90%。`(stale)` 表示刷新失败，当前显示旧数据；悬停可查看原因。

需要桌面版 VS Code 1.85+。使用 WSL、SSH 或容器时，CLI 需安装并登录在对应远程环境中。

## English

View Kiro credit usage in the VS Code status bar.

1. Install and sign in to [Kiro CLI](https://kiro.dev/docs/getting-started/installation/). Make sure `kiro-cli` runs in the extension host's environment.
2. Install this extension. Usage appears on the right; click to refresh, or run **Kiro Usage: Refresh**.
3. If **CLI not found** appears, open **Kiro Usage: Open Settings** and set the absolute CLI path. Use an `.exe` on Windows. Restart VS Code after changing PATH.

🟢 <60% · 🟡 60–90% · 🔴 >90%. `(stale)` means a refresh failed and the previous value is shown; hover for details.

Requires desktop VS Code 1.85+. For WSL, SSH or containers, install and authenticate the CLI in that remote environment.

## 设置 / Settings

| Setting | Default | 说明 / Description |
| --- | --- | --- |
| `kiro-usage.cliPath` | `kiro-cli` | CLI 路径，不含额外引号或参数 / Executable path, without surrounding quotes or arguments |
| `kiro-usage.refreshIntervalSeconds` | `60` | 刷新间隔（秒），`0` 仅手动 / Refresh delay in seconds; `0` for manual only |
| `kiro-usage.timeoutSeconds` | `30` | 请求超时（5–120 秒） / Request timeout (5–120 seconds) |

独立社区扩展，非 Kiro/AWS 官方产品。 / Independent community extension, not affiliated with Kiro or AWS.

[MIT](LICENSE)
