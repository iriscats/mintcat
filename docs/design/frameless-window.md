# 无边框窗口（Frameless）改造说明

主窗口在 Tauri 2 中通过 `decorations: false` 去掉系统标题栏与边框，由前端自行提供拖拽区域与窗口控制按钮，以满足自定义顶栏视觉与布局需求。

## 1. 目标与取舍

| 目标 | 说明 |
|------|------|
| 视觉 | 去除原生标题栏，顶栏完全由 React（如 `TitleBar`）绘制，圆角/主题统一。 |
| 交互 | 保留拖动、最小化、最大化/还原、关闭；必要时保留边缘调整大小。 |

**取舍**：关闭 `decorations` 后，系统不再提供标题栏与窗口按钮，上述能力必须在网页层 + Tauri 窗口 API 中补齐，否则用户无法移动或关闭窗口。

## 2. 后端配置（`src-tauri/tauri.conf.json`）

在主窗口条目上增加：

```json
"decorations": false
```

可选（按产品需求）：

- **`transparent`**：若需要窗口透明/圆角穿透，可设为 `true`；需同时处理 WebView 背景与可能的点击穿透问题。
- **`shadow`**：无边框时是否保留系统阴影（平台行为不同，需在 Windows 实机确认）。

**标签**：主窗口 label 需与能力集、代码中 `get_webview_window("main")` 等引用一致（当前为 `main`）。

## 3. 能力集（`src-tauri/capabilities/default.json`）

无边框后，前端会调用窗口 API，需为对应窗口授予权限（以 Tauri 2 实际权限名为准），通常包括：

- **拖拽**：`core:window:allow-start-dragging`（若使用 `data-tauri-drag-region` / 程序化 start drag）。
- **窗口状态**：`core:window:allow-minimize`、`core:window:allow-toggle-maximize`、`core:window:allow-unmaximize`、`core:window:allow-is-maximized`（按需）。
- **关闭**：已有 `core:window:allow-close` 时，自定义关闭按钮可继续调用 `close()`；若关闭流程仍走 Rust 里 `CloseRequested` 与 `exit(0)`，行为与现网一致。

子窗口（如 `add-mod-dialog`）若同样无边框，应在同一 capability 的 `windows` 列表中列出，并视情况补齐相同权限。

## 4. 前端改造要点

### 4.1 拖拽区域

- 在**非交互**的顶栏区域使用 `data-tauri-drag-region`（或文档推荐的等价方式），使窗口可被拖动。
- **不要**把按钮、链接、输入框、Popover 触发区等放入拖拽区域，否则会导致点击失效或难以点击。

### 4.2 窗口控制按钮

使用 `@tauri-apps/api/window`（如 `getCurrentWindow()`）调用：

- `minimize()`
- `toggleMaximize()` 或 `maximize()` / `unmaximize()`（配合 `isMaximized()` 切换图标）
- `close()`

布局上建议在 `TitleBar` 右侧（或符合 macOS/Windows 习惯的固定侧）增加最小化、最大化、关闭按钮。

### 4.3 与现有 `TitleBar` 的关系

当前 `TitleBar` 已承担品牌、版本、启动游戏等业务操作；无边框后应**增加**：

- 明确的可拖拽条或留白区域（与上述按钮分区）。
- 系统级窗口控件（除非产品决定仅用菜单/快捷键关闭，不推荐）。

## 5. 平台与体验

- **Windows**：为主要发行平台；注意高分屏、最大化后布局、与 Ant Design 顶栏的 z-index。
- **macOS / Linux**：若日后在该仓库启用同包，`decorations: false` 仍可用，但红绿灯位置习惯不同，可后续再按平台分支 UI。

## 6. 测试清单（建议）

- [ ] 顶栏空白处可拖动窗口；按钮、下拉、Popover、头像等可正常点击。
- [ ] 最小化、最大化/还原、关闭均可用；关闭后进程行为与改造前一致（含单例聚焦等）。
- [ ] 窗口边缘可调整大小（若当前依赖原生边框，无边框后若无法 resize，需在配置或交互上补救）。
- [ ] 子窗口（若有）与主窗口样式/权限一致，无白屏或无法关闭。

## 7. 参考资料

- Tauri 2 窗口配置：`decorations`、`transparent`、`shadow` 等见官方 schema / 文档。
- 自定义标题栏与 `data-tauri-drag-region`：见 Tauri「Window customization」类文档。
