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

## 每日用量日历 / Daily calendar

双击右下角状态栏打开完整月历；单击仍刷新（等待 450 ms 区分双击）。也可运行 **Kiro Usage: Open Daily Calendar**。状态栏原有图标、文字、颜色与刷新动画保持不变。

- 页面底色、文字、控件使用 VS Code 主题变量，随亮色、暗色、高对比度主题更新。
- 按本机时区自然日（00:00 分界）记录累计额度的增量，数据保存在扩展的本地全局存储中，多个窗口共用并加锁写入。
- 月额度使用 CLI 的套餐总额度。绿色：日用量 ≤ 0.8 × 月额度 / 22；黄色：超过绿色阈值且 ≤ 2 × 月额度 / 22；红色：超过红色阈值。等于阈值归入较低档。无有效额度不分级。
- 从第一次采集建立基线，不把既有月累计量计为今天的用量。历史不能回填，首次使用显示 0。跨午夜的增量统一计入本次采集日期的前一个自然日（跨多日也采用同一规则）；额度重置、套餐变化与时区变化会重新建立基线。当天同一时区、同一额度下的连续读数差值计入当日。
- 自动刷新开启时也会在午夜安排一次查询；VS Code 关闭、休眠或刷新失败时无法保证午夜采集。`refreshIntervalSeconds: 0` 保持仅手动刷新。
- 此记录是本机采样统计，不是服务端账单。切换登录账号前请备份并清理扩展存储中的 `daily-usage-v1.json`，CLI 当前用量输出没有账号标识。
- 每日颜色采用该日最后采集的套餐额度。未记录与未来日期显示 `—`，不会标成零用量。

自定义颜色：`kiroUsage.calendarLow`、`kiroUsage.calendarMedium`、`kiroUsage.calendarHigh`，可在 `workbench.colorCustomizations` 中覆盖。
