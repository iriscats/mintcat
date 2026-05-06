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

## 7. 桌面悬浮小挂件（独立小窗口）

「小挂件」本质是**第二个（或更多）Webview 窗口**：尺寸小、常置顶、通常无边框且背景透明，看起来像浮在桌面上的一块 UI。与主窗口的 frameless 改造共用同一套思路（`decorations: false`、自绘 UI、自管关闭/拖拽），但产品目标不同：主窗口偏完整应用，小挂件偏轻量常驻。

### 7.1 能力边界（先定预期）

| 目标 | Tauri v2 是否容易做到 | 说明 |
|------|----------------------|------|
| 无边框 + 透明背景 + 圆角/异形**外观** | 是 | `transparent: true` + CSS（圆角、`clip-path`、阴影）即可；窗口仍是矩形，只是透明区域「看不见」。 |
| 始终在其他窗口之上 | 是 | `alwaysOnTop: true`（平台行为略有差异，需在 Win/macOS 实机确认）。 |
| 不出现在任务栏（可选） | 是（视平台） | `skipTaskbar: true`；若某平台表现异常，可再评估是否关闭该选项。 |
| 透明区域**不抢鼠标**（点击穿透到下层） | 部分 | 常见做法是整窗 `setIgnoreCursorEvents(true)`；**按像素**「只有透明处穿透」没有统一跨平台 API，需 Windows/macOS 等原生层单独做命中测试。 |
| 系统级「非矩形可点击区域」 | 难 | 需各平台 Win32 / Cocoa 等扩展，维护成本高，文档级建议默认不做。 |

### 7.2 推荐配置项（小挂件窗口）

在**小挂件专用**窗口上组合使用（主窗口不必全部照抄）：

- **`decorations: false`**：无边框，自绘。
- **`transparent: true`**：允许 WebView 区域透明；需配合前端把根节点背景清掉（见 7.5）。
- **`shadow: false`**：多数挂件希望轮廓干净；若需要「卡片浮起」感，可改用 CSS `box-shadow`。
- **`alwaysOnTop: true`**：置顶。
- **`skipTaskbar: true`**（按需）：减少任务栏噪音。
- **`resizable: false`**（常见）：固定小尺寸；若允许用户拉大，再打开并设 `minWidth` / `minHeight`。
- **`width` / `height`**：按设计稿给固定像素；注意高分屏下与 `scaleFactor` 相关的观感，需在 Windows 实机看一眼。
- **`dragDropEnabled`**：与产品一致；主仓里子窗口已有 `true`/`false` 两种用法，小挂件一般可关 `false` 以免误拖文件触发系统行为。

**标签（label）**：单独命名，例如 `desktop-widget`，并在 `capabilities` 里为该 label 授权（与 `main`、`add-mod-dialog` 并列），否则前端调用窗口 API 可能被权限拦截。

### 7.3 实现方式 A：`tauri.conf.json` 里增加静态窗口

适合：**希望应用启动时就有小挂件**，或 URL 固定、生命周期简单。

在 `app.windows` 数组中新增一项（示例字段名以当前仓库所用 [Tauri 2 config schema](https://schema.tauri.app/config/2) 为准）：

```json
{
  "label": "desktop-widget",
  "url": "index.html#/desktop_widget",
  "title": "MintCat Widget",
  "width": 280,
  "height": 120,
  "decorations": false,
  "transparent": true,
  "shadow": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "visible": false,
  "dragDropEnabled": false
}
```

- 若首发不展示，可设 **`visible: false`**，再由前端或 Rust 在合适时机 `show()`。
- **`url`** 需在前端路由中实现对应页面（如 React Router 的 `desktop_widget`）。

### 7.4 实现方式 B：运行时 `WebviewWindow`（与现有子窗口一致）

适合：**主程序已运行，按需打开/复用**小挂件；与当前 `add-mod-dialog` 子窗口模式一致，仅在创建参数上增加挂件专用选项。

主仓参考：`src/dialogs/AddModDialog/open.ts` 中 `new WebviewWindow('add-mod-dialog', { ... })`。

小挂件示例（仅说明字段，具体路由与单例缓存策略按产品定）：

```ts
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const widget = new WebviewWindow("desktop-widget", {
  url: "index.html#/desktop_widget",
  title: "MintCat Widget",
  width: 280,
  height: 120,
  decorations: false,
  transparent: true,
  shadow: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  dragDropEnabled: false,
});
```

- 与 Add Mod 对话框相同：可监听 `tauri://created` / `tauri://destroyed`，并自行缓存 `windowInstance` 避免重复创建。
- 若需**记住上次屏幕位置**，可在显示前用 `@tauri-apps/api/window` 的 `outerPosition` / `setPosition` 等（需在能力集中授予对应 `core:window:allow-*` 权限，名称以 `src-tauri/gen/schemas` 生成结果为准）。

### 7.5 前端样式要点（透明 + 「异形」观感）

1. **根背景透明**：`html, body, #root`（或实际挂载根）背景设为 `transparent`，否则会出现整块底色，透明窗口失效。
2. **内容区单独铺底**：挂件卡片容器使用实色背景、`border-radius`、`box-shadow`；需要「异形」时用 `clip-path` 或 SVG/图片遮罩，但**命中区域仍是矩形窗口**，透明处是否吃鼠标见 7.1。
3. **拖拽**：在可拖动的非交互区域加 `data-tauri-drag-region`；按钮、开关等不要放在该区域上。
4. **关闭/隐藏**：提供明确入口；若仅 `hide()` 不 `close()`，需定义再次打开的逻辑（与单例 `WebviewWindow` 配合）。

### 7.6 能力集（`capabilities`）

1. 在对应 capability 的 **`windows`** 数组中加入小挂件的 **label**（如 `desktop-widget`）。
2. 视交互补充权限（与第 3 节相同思路），例如：
   - 拖拽：`core:window:allow-start-dragging`
   - 显示/隐藏/关闭：`core:window:allow-show`、`core:window:allow-hide`、`core:window:allow-close`（已有则沿用）
   - 若程序内改置顶、位置、忽略光标事件等，按 Tauri 2 生成的权限表逐项 `allow-*` 打开

生成工程若尚未提交 `gen/schemas`，以本地运行 `pnpm tauri dev` / 构建后生成的 capability 校验为准。

### 7.7 点击穿透（可选）

若产品需要「鼠标能点到挂件下面的游戏/桌面」：

- **整窗穿透**：在挂件窗口上调用 **`setIgnoreCursorEvents(true)`**（具体 API 以 `@tauri-apps/api` 当前版本为准）；需要可点击 UI 时，再在可交互时段切回 `false`，或采用「展开面板时可点、收起时穿透」等状态机。
- **按像素穿透**：默认不做；若必须做，在设计文档中单独立项，按平台拆分原生实现。

### 7.8 与主窗口共存的注意点

- **单例应用逻辑**：若 Rust 侧有「仅允许一个应用实例」或关闭主窗即退出进程，需明确小挂件是否随主窗关闭、是否单独 `exit`、是否阻止 `CloseRequested`。
- **更新与重启**：自动更新或重启应用时，小挂件窗口生命周期要与主流程一致，避免出现「孤儿窗口」或重复 label 创建失败。

### 7.9 小挂件专项测试清单（建议）

- [ ] 透明区域无意外灰底/白底；多显示器与缩放比例下尺寸正常。
- [ ] 置顶符合预期，且不与全屏游戏/独占模式冲突（按需测试）。
- [ ] 拖拽、按钮、右键菜单（若有）互不干扰。
- [ ] `skipTaskbar` 若开启，用户仍能通过托盘/主窗菜单找到挂件或重新打开。
- [ ] 若使用点击穿透：展开/收起状态下鼠标行为符合设计。

## 8. 参考资料

- Tauri 2 窗口配置：`decorations`、`transparent`、`shadow` 等见官方 schema / 文档。
- 自定义标题栏与 `data-tauri-drag-region`：见 Tauri「Window customization」类文档。
