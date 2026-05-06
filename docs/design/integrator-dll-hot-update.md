# MintCat 安装器 DLL 化与热更新设计

## 背景

当前 DRG / Rogue Core 的安装逻辑位于 `src-tauri/src/integrator/drg` 与 `src-tauri/src/integrator/drgrc`，由 Tauri command `install_mods` 直接调度。安装核心逻辑中大量使用 `tauri::AppHandle` 和 `Emitter` 上报状态栏日志、进度、成功与失败事件。

这使安装器逻辑与 MintCat 主程序强耦合，导致以下问题：

- 安装器修复必须随主程序一起发版。
- DRG / RC 游戏更新后，安装兼容性修复无法独立热更新。
- 安装核心难以被单独测试或复用。
- 后续做 DLL 或独立安装运行时，需要先移除 Tauri 依赖。

## 目标

最终目标是将 DRG / DRGRC mod 安装核心拆成独立运行时，支持通过 `update.json` 下载、校验、加载和热更新。

推荐最终结构：

```text
Frontend / Task
    ↓
Tauri Host Adapter
    ↓ libloading / DLL FFI
mintcat_integrator.dll
    ↓
Integrator Core
    ├─ DRG installer
    ├─ DRGRC installer
    ├─ UE4SS installer
    ├─ Pak / AssetRegistry / uasset utils
    └─ Zip / file helpers
```

## 非目标

第一阶段不直接生成 DLL，也不改动现有安装行为。第一阶段只做安装器核心去 Tauri 化，保证主程序仍能通过现有 Tauri command 完成安装。

## 当前安装链路

```text
IntegrateApi.installMods()
  → taskQueueAPI.addTask('mod_install')
  → ModInstallTask
  → invoke('install_mods')
  → integrator::drg::install_mods
  → do_install_mods
  → PakIntegrator / RcPakIntegrator
  → AppHandle.emit(...)
```

当前主要耦合点：

- `drg/mod.rs` 同时负责 Tauri command、线程启动、游戏类型分发、错误事件。
- `drg/pak_integrator.rs` 和 `drgrc/pak_integrator.rs` 直接依赖 `tauri::AppHandle`。
- 安装结果通过 `install-success` / `install-error` 事件隐式返回。

## 阶段 1：安装进度抽象

新增安装器事件与上报接口：

```rust
pub enum InstallEvent {
    StatusLog(serde_json::Value),
    Percent(f32),
    Success(u64),
    Error(serde_json::Value),
}

pub trait InstallProgress: Send + Sync {
    fn emit(&self, event: InstallEvent) -> anyhow::Result<()>;
}
```

在 Tauri 主程序中提供 adapter：

```rust
pub struct TauriInstallProgress {
    app: tauri::AppHandle,
}
```

adapter 负责将安装事件转换成现有 Tauri 事件：

| InstallEvent | Tauri event |
|---|---|
| `StatusLog` | `status-bar-log` |
| `Percent` | `status-bar-percent` |
| `Success` | `install-success` |
| `Error` | `install-error` |

这样安装核心只依赖 `InstallProgress`，不再直接依赖 `AppHandle`。

## 阶段 2：核心 crate 拆分

新增 workspace crate：

```text
crates/mintcat-integrator-core
```

迁移内容：

```text
src-tauri/src/integrator/drg
src-tauri/src/integrator/drgrc
src-tauri/src/integrator/ue4ss
src-tauri/src/uasset_utils
安装器依赖的 zip helper
```

主程序先通过普通 Rust crate 静态依赖，确保行为不变。

## 阶段 3：FFI / DLL wrapper

新增：

```text
crates/mintcat-integrator-ffi
```

`Cargo.toml`：

```toml
[lib]
crate-type = ["cdylib"]
```

DLL 边界使用 C ABI + JSON，避免 Rust ABI 不稳定问题：

```c
typedef void (*MintCatProgressCallback)(const char* event_json, void* user_data);

uint32_t mintcat_integrator_abi_version(void);

int32_t mintcat_integrator_install(
    const char* request_json,
    MintCatProgressCallback callback,
    void* user_data,
    char** response_json,
    char** error_message
);

void mintcat_integrator_free_string(char* ptr);
```

要求：

- 不跨 FFI 暴露 Rust struct。
- 不让 panic 穿过 FFI 边界，必须 `catch_unwind`。
- DLL 分配的字符串必须由 DLL 自己释放。
- callback 只在函数调用期间有效，DLL 不保存 callback 指针。

## 阶段 4：主程序动态加载

主程序新增 runtime loader：

```text
src-tauri/src/integrator_runtime
  ├─ mod.rs
  ├─ loader.rs
  └─ api.rs
```

职责：

- 从 `update.json` 识别 `mintcat-integrator`。
- 下载 DLL 到版本目录。
- 校验 sha256 / signature。
- 校验 ABI version。
- 加载 DLL 并调用安装函数。
- 将 DLL callback 转换为 `InstallEvent` / Tauri event。
- 失败时回退内置安装器或提示错误。

版本目录示例：

```text
AppData/com.mint.cat/plugins/
  0.1.0/mintcat_integrator.dll
  0.1.1/mintcat_integrator.dll
  state.json
```

不要覆盖 active DLL，因为 Windows 下已加载 DLL 无法覆盖。

## update.json 扩展

新增运行时资源：

```json
{
  "name": "mintcat-integrator",
  "type": "runtime",
  "channel": "stable",
  "latestVersion": "0.1.0",
  "fileSize": 10485760,
  "sha256": "...",
  "signature": "...",
  "downloadUrl": "mintcat_integrator_0.1.0_x64.dll",
  "releaseNotes": "Update DRG/RC installer logic"
}
```

启动更新 task 可以统一检测：

- frontend
- mintcat-integrator
- ue4ssl
- drg
- rc

## 热更新规则

1. DLL 必须下载到版本化目录。
2. 不覆盖当前 active DLL。
3. 安装任务开始时加载 DLL，任务结束后释放 `Library`。
4. DLL 不保存主程序指针和 callback。
5. ABI 不匹配则拒绝加载。
6. 校验失败不激活新 DLL。
7. 新 DLL 安装失败可回退到 previous version 或内置安装器。

## 风险

- DLL 崩溃会带崩主程序；若更重视隔离性，可改为独立 exe 模式。
- `repak` / `unreal_asset` / Oodle 相关依赖会让 DLL 较大。
- FFI 边界必须保持稳定，不能传 Rust 类型。
- Windows 文件锁要求版本化目录和延迟清理。

## 执行计划

### Step 1

在当前 `src-tauri` 内新增安装事件与进度上报抽象，替换 `PakIntegrator` / `RcPakIntegrator` 对 `AppHandle` 的直接依赖。

### Step 2

将 DRG / DRGRC 公共模块整理到 common：

```text
common/mod_bundle_writer.rs
common/unpacked_mod.rs
common/audio_pak.rs
common/zip.rs
```

### Step 3

创建 `mintcat-integrator-core` crate，主程序静态依赖。

### Step 4

创建 `mintcat-integrator-ffi` cdylib。

### Step 5

主程序增加 runtime loader，接入 `update.json`。

### Step 6

实现 DLL 下载、校验、激活、回退和旧版本清理。
