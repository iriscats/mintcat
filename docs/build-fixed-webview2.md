# WebView2 内嵌版（fixed_webview2）打包说明

将 WebView2 固定版本运行时内嵌到 Windows 安装包中，适用于企业环境或无法安装/更新 WebView2 的系统。

## 与默认包的区别

| 项目       | 默认包                     | fixed_webview2 包                    |
|------------|----------------------------|--------------------------------------|
| WebView2   | 安装时通过 Bootstrapper 下载 | 内嵌固定版本，无需联网或系统预装     |
| 安装包体积 | 较小（约 14MB）            | 约 200MB+（内嵌 WebView2 运行时）    |
| 适用场景   | 个人用户、可联网环境       | 企业、离线、受限环境                 |

## 打包步骤

### 1. 一键打包（推荐）

在项目根目录执行：

```bash
# macOS/Linux 需先安装 cabextract（解压 .cab）
# brew install cabextract   # macOS

pnpm build:fixed-webview2
```

或指定 WebView2 版本：

```bash
WEBVIEW2_VERSION=133.0.3065.92 pnpm build:fixed-webview2
# 或
node scripts/build-fixed-webview2.mjs 133.0.3065.92
```

### 2. 脚本自动完成的操作

1. **下载**：从 [WebView2RuntimeArchive](https://github.com/westinyang/WebView2RuntimeArchive/releases) 下载指定版本的 x64 固定版运行时 **.cab**（默认 `133.0.3065.92`；该仓库仅提供 .cab，无 .zip）。
2. **解压**：用系统工具解压 .cab 到 `src-tauri/Microsoft.WebView2.FixedVersionRuntime.x64/`（macOS/Linux 需已安装 `cabextract`，如 `brew install cabextract`）。
3. **切换配置**：用 `src-tauri/webview2.x64.json` 覆盖 `tauri.windows.conf.json`（`webviewInstallMode` 改为 `fixedRuntime`，并将 WebView2 目录加入 `bundle.resources` 以打入安装包）。
4. **构建**：执行 `pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-gnu`（与 `release.sh` 一致）。
5. **重命名产物**：在 NSIS 产物文件名中加入 `_fixed_webview2` 后缀，便于与普通安装包区分。
6. **恢复配置**：还原 `tauri.windows.conf.json`。

### 3. 产物位置

- 目录：`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`
- 文件名示例：
  - `mintcat_0.5.0_x64_fixed_webview2-setup.exe`
  - `mintcat_0.5.0_x64_fixed_webview2.nsis.zip`
  - `mintcat_0.5.0_x64_fixed_webview2-setup.exe.sig`（若开启签名）

### 4. 签名与 Updater 产物（可选）

- **不设置签名**：脚本会临时关闭 `createUpdaterArtifacts`，构建能正常完成，产物约 200MB+。不会生成 `latest.json` 等更新检测文件。
- **需要签名并生成更新检测文件**：设置签名私钥后再执行打包：

```bash
export TAURI_SIGNING_PRIVATE_KEY="~/.tauri/mintcat.key"
pnpm build:fixed-webview2
```

## 配置文件说明

- **`src-tauri/webview2.x64.json`**：Windows 捆绑配置的“固定 WebView2”变体，仅包含与默认 `tauri.windows.conf.json` 不同的部分（`webviewInstallMode` 为 `fixedRuntime`，`path` 指向 `./Microsoft.WebView2.FixedVersionRuntime.x64/`）。脚本在构建前会用它覆盖 `tauri.windows.conf.json`，构建后会自动恢复。

## 便携版（可选）

若需要便携 zip（含 exe、资源与内嵌 WebView2），可在本脚本基础上增加一步：将构建产物目录中的 exe、resources 以及 `Microsoft.WebView2.FixedVersionRuntime.x64` 目录一起打成一个 zip。当前脚本仅产出 NSIS 安装包；便携版可参考 [clash-verge-rev portable-fixed-webview2](https://github.com/clash-verge-rev/clash-verge-rev/blob/dev/scripts/portable-fixed-webview2.mjs) 自行扩展。

## 更新 fixed_webview2 的 WebView2 版本

1. 在 [WebView2RuntimeArchive Releases](https://github.com/westinyang/WebView2RuntimeArchive/releases) 中确认目标版本是否存在 x64 zip。
2. 执行打包时传入版本号，例如：`WEBVIEW2_VERSION=145.0.3800.65 pnpm build:fixed-webview2`。
3. 若新版本解压后的目录名与 `Microsoft.WebView2.FixedVersionRuntime.x64` 不一致，脚本会先解压到临时目录再重命名为该目录，无需改 `webview2.x64.json` 中的 `path`。
