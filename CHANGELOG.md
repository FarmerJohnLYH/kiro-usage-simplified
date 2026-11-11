## 1.0.0

- Release the daily credit calendar with the purple ghost-and-chart extension icon.
- Preserve the existing status bar appearance and theme-aware calendar.

## 0.2.2

- Remove the calendar detail footer, divider lines and last-collected information.

## 0.2.1

- Attribute cross-midnight increments to the previous calendar day.
- Simplify calendar UI by removing explanatory notes, partial-record asterisks, timezone subtitle and legend.

## 0.2.0

- Add a theme-aware full-month daily credit calendar, opened by double-clicking the existing status bar or a command.
- Persist local daily deltas with serialized cross-window writes; distinguish partial records, midnight gaps and quota resets.
- Use plan quota for traffic-light thresholds; preserve existing status bar appearance.

# Changelog / 更新日志

## 0.1.2

- Manual refresh replaces the existing status icon with a spinner and keeps the usage text unchanged. Automatic refresh remains quiet.
- 主动刷新时仅将状态图标替换为旋转图标，保留用量文字；自动刷新保持静默。

## 0.1.1

- Keep the current status bar text, color and tooltip while refreshing; remove the updating label and spinner.
- 刷新期间保留当前状态栏文字、颜色和提示，移除 updating 标签与旋转图标。

## 0.1.0

- Show Kiro credit usage, percentage and threshold colors in the status bar.
- Add manual refresh, configurable polling, timeout and executable path.
- Handle missing CLI, authentication, unsupported output, timeout and process failures without unhandled rejections.
- Mark cached values as stale after failures; cancel requests on configuration changes and shutdown.
- Add bilingual documentation, automated tests and VSIX packaging checks.

- 在状态栏显示 Kiro 用量、百分比和阈值颜色。
- 支持手动刷新、刷新间隔、超时和可执行文件路径配置。
- 处理 CLI 缺失、认证失败、输出不兼容、超时和进程错误，避免未处理的异步异常。
- 失败时明确标记旧数据；配置变更或退出时取消请求。
- 补充中英双语文档、自动化测试和 VSIX 打包检查。
