**Full Changelog**: https://github.com/iris-cat-dev/mintcat/compare/v0.5.3...v0.5.4

下载地址 / Download：https://github.com/iris-cat-dev/mintcat/releases

# 中文

## 新增

1. 新增框架（Framework）设置，可以禁用 UE4SS 提高部分掉帧玩家体验。
2. 新增前端资源与安装器运行时更新机制，支持独立热更新前端和 runtime。
3. 前端 Mod 列表新增序号方便用户定位 Mod。

## 优化

1. 优化 “Buyable Mission” Mod 缺少选项的问题。
2. 优化暗色主题显示不明显问题。
3. 优化滚动条不明显问题。
4. 优化 TreeView 版本选择交互与样式展示。
5. 优化搜索框，支持动态过滤与更清晰的搜索交互。
6. 优化下载流程，补充断点续传、重试、缓存校验和下载状态更新。
7. 优化分组删除、在线 Mod 不可用、下载失败等场景的错误提示。
8. 优化状态栏、标题栏、菜单栏和引导流程中的部分 UI 表现。
9. 优化本地化文案，统一中英文提示与错误信息。
10. 优化请求日志脱敏，减少 token、鉴权参数等敏感信息暴露风险。
11. 优化 Mod 批量启用和批量禁用。
12. 优化TreeView 文件夹排序能力。

## 修复

1. 修复切换 Profile、启停 Mod 或更新在线 Mod 后部分场景不会正确刷新 TreeView 状态的问题。
2. 修复在线 Mod 更新后版本、下载进度、缓存路径与更新时间戳不同步的问题。
3. 修复安装前本地缓存缺失或在线版本变化时未自动补齐下载的问题。
4. 修复部分分组删除和下载失败场景下错误处理不一致的问题。

## 重构

1. 重构 runtime 加载、校验、更新与资源路径处理，支持后续 DLL/独立运行时热更新。
2. 重构 Pak 资源集成、冲突序列化与音频 Pak 处理流程。
3. 重构网络层，新增 `NetworkClient`、路由策略、认证解析和统一请求类型。
4. 重构 ModMapper、资源处理和部分 ViewModel 初始化流程。

# English

## New

1. Add Framework settings, allowing UE4SS to be disabled to improve the experience for some players affected by frame drops.
2. Add frontend asset and installer runtime update mechanisms, supporting independent hot updates for the frontend and runtime.

## Improvements

1. Improve missing options for the “Buyable Mission” mod.
2. Improve low-contrast display issues in the dark theme.
3. Improve scrollbar visibility.
4. Improve TreeView version selection interaction and styling.
5. Improve SearchBox with dynamic filtering and clearer search behavior.
6. Improve the download flow with resume support, retries, cache validation, and download status updates.
7. Improve error messages for group deletion, unavailable online mods, and download failures.
8. Improve selected UI details in the status bar, title bar, menu bar, and onboarding flow.
9. Improve localization strings and align Chinese/English prompts and errors.
10. Improve request log sanitization to reduce exposure of tokens and authentication parameters.
11. Improve batch enable and disable actions for mods.
12. Improve TreeView folder ordering support.

## Fixes

1. Fix TreeView state not refreshing correctly after profile switches, mod enable/disable actions, or online mod updates in some cases.
2. Fix version, download progress, cache path, and timestamp data not staying in sync after online mod updates.
3. Fix missing automatic downloads before installation when local cache is missing or the online version has changed.
4. Fix inconsistent error handling for some group deletion and download failure cases.

## Refactoring

1. Refactor runtime loading, validation, update handling, and asset paths to support future DLL/standalone runtime hot updates.
2. Refactor Pak asset integration, conflict serialization, and audio Pak handling.
3. Refactor the network layer with `NetworkClient`, route policies, auth resolving, and unified request types.
4. Refactor ModMapper, asset handling, and parts of ViewModel initialization.
