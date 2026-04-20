# MintCat 内部资源 P2P 加速设计（BitTorrent + Web Seed）

## 1. 概述

### 1.1 目标

为 UE4SSL / DRG / RC 等内部 ZIP 资源增加 **BitTorrent 加速层**：在有多 peer 或 Web Seed 可用时并行拉取数据；在 BT 冷启动失败或超时后 **无感回退** 到现有 HTTPS 下载，不改变 MD5 终校验与 manifest 语义。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| 不替代 HTTP | HTTPS 直链作为 [Web Seed (BEP 19)](https://www.bittorrent.org/beps/bep_0019.html)，无 peer 时仍可完成下载。 |
| 信任链不变 | `magnet` / `torrentUrl` 由可信的 `checkUpdatesBatch`（HTTPS）下发；完成后仍做整文件 MD5，与 HTTP 路径一致。 |
| 零自建中继 | 依赖公共 tracker + DHT/PEX；家庭 NAT 场景依赖 uTP、UPnP/NAT-PMP 等 BT 常规能力，不引入独立 relay 服务。 |

---

## 2. 架构与数据流

```
┌─────────────────────┐     checkUpdatesBatch      ┌──────────────────────┐
│  Release API (HTTPS)│ ─────────────────────────► │  MintCat 客户端       │
│  + md5 / magnet 等   │                            │  InternalAssetService │
└─────────────────────┘                            └──────────┬───────────┘
                                                              │
                     ┌────────────────────────────────────────┼────────────────────────┐
                     │ P2P 优先                                │ HTTP 回退               │
                     ▼                                        ▼                        │
            ┌────────────────┐                      ┌────────────────┐                │
            │ librqbit Session│                      │ DownloadApi     │                │
            │ DHT / uTP / UPnP│                      │ .downloadFile   │                │
            │ + Web Seed      │                      │ (NetworkApi)    │                │
            └────────┬────────┘                      └────────────────┘                │
                     │                                                                  │
                     └──────────────────────► 同一 destPath、同一 MD5 / ZIP 校验 ◄──────┘
```

**典型路径**：

1. `checkUpdatesBatch` 返回 `magnet` 或 `torrentUrl`（及 `md5`）。
2. `InternalAssetService.downloadAndValidateZip` 先调用 `DownloadApi.downloadViaP2P`；失败则删除半成品并走原有 `downloadFile` 重试逻辑。
3. Rust 侧 `p2p_download` 异步执行 `add_and_wait`：首 piece 在约 20s 内无进度则失败，触发前端回退 HTTP。
4. 成功后与 HTTP 路径相同：`IntegrateApi.validateZipFile` + `writeManifest`。

**会话与持久化**：

- Session 数据目录：缓存目录下 `p2p_state/`（JSON 持久化，支持 fastresume / 重启后续种）。
- Session **懒加载**：首次 P2P 下载或设置同步时创建；关闭「P2P 加速」或应用退出时 `session.stop()`。

---

## 3. 已实现内容

### 3.1 后端（Rust / Tauri）

| 项 | 位置 / 说明 |
|----|-------------|
| 依赖 | `src-tauri/Cargo.toml`：`librqbit`（`default-tls` 等特性与项目 TLS 栈对齐）。 |
| 状态与会话 | `src-tauri/src/capability/p2p/session.rs`：`P2pState`、`P2pSettings`（enabled / seed / upload_limit 记录）、`get_or_init_session`、`shutdown`、`torrent_counts`、`stop_all_seeding`（关闭做种时移除已完成 torrent，保留文件）。 |
| 单任务 | `src-tauri/src/capability/p2p/task.rs`：`add_and_wait`、进度事件 `p2p-progress`、状态 `p2p-status`、首 piece 超时、重命名到目标文件名、MD5 终校验。 |
| 命令 | `src-tauri/src/capability/p2p/mod.rs`：`p2p_download`、`p2p_set_enabled`、`p2p_set_seeding`、`p2p_set_upload_limit`、`p2p_stats`。 |
| 生命周期 | `src-tauri/src/lib.rs`：`init_p2p_state`、窗口 `CloseRequested` 前 `p2p.shutdown().await`。 |

### 3.2 前端

| 项 | 位置 / 说明 |
|----|-------------|
| 类型 | `src/apis/mintcat/types.ts`：`UpdateCheckResult.magnet?`、`torrentUrl?`。 |
| 下载封装 | `src/apis/DownloadApi.ts`：`downloadViaP2P`（事件与 HTTP 下载进度语义对齐）、`setP2PEnabled` / `setP2PSeeding` / `setP2PUploadLimit` / `getP2PStats`。 |
| 业务集成 | `src/services/InternalAssetService.ts`：P2P 优先 + 失败回退 HTTP；进度文案区分 `[P2P]` / `[HTTP]`。 |
| 设置持久化 | `src/storage/dao/SettingDAO.ts`：`p2p.enabled`、`p2p.seeding`、`p2p.uploadLimitBytesPerSec`。 |
| 设置 UI | `src/pages/SettingPage/MintCatSettings.tsx`：P2P 开关、做种开关、上传限速（KB/s）；进入页面时把 DB 中的值同步到后端。 |
| 文案 | `src/locales/en.json`、`zh-CN.json`：相关键与下载详情模板。 |

### 3.3 发版侧工具（仓库内）

| 项 | 说明 |
|----|------|
| `scripts/make-torrent.mjs` | 为本地文件生成 `.torrent`（含 Web Seed URL、多 tracker 等），stdout 输出 magnet，供流水线或人工拷贝到 API。 |

---

## 4. 安全与校验顺序

1. **元数据来源**：`magnet` / `torrentUrl` 仅通过 HTTPS 的更新检查接口下发（与现有版本/MD5 同源）。
2. **BT 层**：piece 级校验由 BitTorrent 协议保证。
3. **应用层**：Rust 在完成写入后对目标文件做 **MD5**（与 HTTP 下载相同字段）；`InternalAssetService` 仍做 **ZIP 完整性**校验后再写入 manifest。

任一环节失败会删除损坏文件并按现有逻辑重试或回退 HTTP。

---

## 5. NAT 与做种说明（摘要）

- **下载**：主动出站即可，一般家庭网络无额外要求。
- **上传 / 做种**：依赖 UPnP/NAT-PMP 等；无法映射时可能无法有效做种，但不影响本机下载；Web Seed 仍保证「无 peer 也能下完」。
- **隐私**：BT 可能向其他 peer 暴露公网 IP；设置中提供「P2P 加速 / 做种」开关，用户可关闭做种或整体关闭 P2P。

---

## 6. 未完成或与计划差异项

以下条目便于后续迭代与发版协作对齐，**不代表客户端未实现主干功能**。

### 6.1 服务端 / 发版流水线（仓库外）

| 项 | 状态 |
|----|------|
| `release.sh` 或 CI 中自动生成 `*.zip.torrent` 并上传 | **未在本仓库内接线**，需运维在发版流程中调用 `scripts/make-torrent.mjs` 或等价逻辑。 |
| `checkUpdatesBatch` 响应中填充 `magnet` / `torrentUrl` | **需后端发布**；字段未下发时客户端行为与旧版一致（直接 HTTP）。 |
| Tracker / piece 长度与计划文档完全一致 | 以 `make-torrent.mjs` 与后端实际配置为准；客户端只消费 magnet 或 torrent URL。 |

### 6.2 与原始计划文案的差异

| 计划点 | 当前实现 |
|--------|----------|
| 上传限速默认 2 MB/s | 当前为 **不限速**（0 = 不限）；用户可在设置中填写 KB/s。若产品要求默认 2 MB/s，需在 `SettingDAO` 默认值或首次同步时写入。 |
| 「总下载率低于 HTTP baseline 则回退」 | **未实现**；当前仅 **首 piece 超时**（默认 20s）+ P2P 整体硬超时（与 DownloadApi 策略一致）触发回退。 |
| `only_files` 限制单文件 | 当前 torrent 按单文件 ZIP 场景处理（解析最大文件 + 重命名）；多文件 torrent 的精细过滤可作为增强。 |
| 设置页展示当前 peer 数 / `p2p_stats` 可视化 | **未做**；后端已有 `p2p_stats`（含 `active_downloads` / `seeding_torrents` 等），前端未在设置页轮询展示。进度事件里 `peers` 字段在 Rust 侧暂为占位（0）。 |
| Session 级上传限速应用到 librqbit | `P2pState` 已记录 `upload_limit_bytes_per_sec`，**与 librqbit Session API 的深度绑定**可在后续版本补全（避免仅「记录、下次 add 生效」的弱保证）。 |

### 6.3 构建与实网验证

| 项 | 说明 |
|----|------|
| Windows（cargo-xwin + `x86_64-pc-windows-msvc`） | 已在开发环境做过 **check** 级别验证；发版仍以 `pnpm tauri build` / `release.sh` 为准。 |
| Linux 自 macOS 交叉编译 | 受 GTK/`gdk-sys` 与 Linux sysroot 限制，与既有 Tauri 交叉策略一致；**Linux 制品建议在 Linux CI 或容器内构建**。 |
| 实网 NAT / 多运营商穿透测试 | **需**带真实 `magnet` 的版本与 peer 环境后单独验收（UPnP 有/无、IPv4 等）。 |

---

## 7. 相关文件索引

| 区域 | 路径 |
|------|------|
| P2P 模块 | `src-tauri/src/capability/p2p/` |
| Tauri 注册与关闭 | `src-tauri/src/lib.rs` |
| 前端下载与设置 | `src/apis/DownloadApi.ts`、`src/pages/SettingPage/MintCatSettings.tsx` |
| 内部资源下载 | `src/services/InternalAssetService.ts` |
| 工具脚本 | `scripts/make-torrent.mjs` |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-20 | 初稿：对齐当前实现与计划差异，列出服务端与增强项。 |
