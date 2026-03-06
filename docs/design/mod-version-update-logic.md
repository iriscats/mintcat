# Mod Version Update Business Logic

## 概述

本文档详细说明 MintCat 应用中 Mod 版本更新检测、管理和显示的完整业务逻辑。

## 1. 数据模型

### 1.1 核心表结构

#### `mods` 表
存储 Mod 的基础信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `modId` | INTEGER | 主键，Mod 唯一标识符 |
| `platformId` | INTEGER | mod.io 平台 ID（用于 API 调用） |
| `gameId` | INTEGER | 游戏 ID |
| `nameId` | TEXT | Mod 名称标识符 |
| `displayName` | TEXT | Mod 显示名称 |
| `url` | TEXT | Mod 主页 URL |
| `sourceType` | TEXT | 来源类型（`Modio` / `Local`） |
| `tags` | TEXT | Mod 标签（JSON 数组） |
| `approvalStatus` | TEXT | 审核状态（`Verified` / `Approved` / `Sandbox`） |
| `createdAt` | INTEGER | 创建时间戳（毫秒） |
| `updatedAt` | INTEGER | 更新时间戳（毫秒） |

#### `mod_versions` 表
存储 Mod 的版本信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `modId` | INTEGER | 外键，关联 `mods.modId` |
| `currentVersion` | TEXT | 当前已下载的文件版本（fileVersion） |
| `availableVersions` | TEXT | 可用版本列表（JSON 数组） |
| `createdAt` | INTEGER | 创建时间戳（毫秒） |
| `updatedAt` | INTEGER | 更新时间戳（毫秒） |

#### `mod_downloads` 表
存储 Mod 的下载信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `modId` | INTEGER | 外键，关联 `mods.modId` |
| `downloadUrl` | TEXT | 下载 URL |
| `cachePath` | TEXT | 本地缓存路径 |
| `fileSize` | INTEGER | 文件大小（字节） |
| `downloadProgress` | INTEGER | 下载进度（0-100） |
| `downloadStatus` | TEXT | 下载状态 |
| `createdAt` | INTEGER | 创建时间戳（毫秒） |
| `updatedAt` | INTEGER | 更新时间戳（毫秒） |

#### `mod_status` 表
存储 Mod 的状态信息（核心更新检测字段）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `modId` | INTEGER | 外键，关联 `mods.modId` |
| `lastUpdateDate` | INTEGER | **最后更新日期（毫秒）** - 本地文件最后更新时间 |
| `onlineUpdateDate` | INTEGER | **在线更新日期（毫秒）** - mod.io 上最新版本的发布时间 |
| `isOnlineAvailable` | BOOLEAN | Mod 是否在线可用 |
| `isLocalNotFound` | BOOLEAN | 本地文件是否缺失 |
| `createdAt` | INTEGER | 创建时间戳（毫秒） |
| `updatedAt` | INTEGER | 更新时间戳（毫秒） |

#### `profile_mods` 表
存储 Profile 中 Mod 的配置（启用状态、用户选择的版本）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键，profile_mods 记录 ID |
| `profileId` | INTEGER | 外键，关联 `profiles.id` |
| `modId` | INTEGER | 外键，关联 `mods.modId` |
| `isEnabled` | BOOLEAN | 是否启用 |
| `usedVersion` | TEXT | **用户选择的版本（usedVersion）** - 用户在此 Profile 中手动选择的版本 |
| `createdAt` | INTEGER | 创建时间戳（毫秒） |
| `updatedAt` | INTEGER | 更新时间戳（毫秒） |

### 1.2 关键字段语义

#### `fileVersion` (mod_versions.current_version)
- **含义**: 当前已下载到本地的 Mod 文件版本
- **更新时机**:
  - 初始下载完成时
  - 用户手动切换版本并下载完成后
  - 自动更新下载完成后
- **数据来源**: mod.io API 的 `modfile.version` 或 `modfile.filename`

#### `usedVersion` (profile_mods.used_version)
- **含义**: 用户在当前 Profile 中明确选择要使用的版本
- **更新时机**: 用户在版本下拉框中手动选择版本时
- **特殊值**:
  - 空字符串 `""`: 表示用户未手动选择，使用默认最新版本
  - 非空: 表示用户明确选择了特定版本（可能是旧版本）
- **作用**: 用于判断是否显示"新版本可用"警告

#### `lastUpdateDate` (mod_status.last_update_date)
- **含义**: 本地 Mod 文件最后更新的时间戳（毫秒）
- **更新时机**:
  - Mod 文件下载完成后，设置为 `onlineUpdateDate`
  - 本地文件（Local 类型）修改时间变化时，设置为文件 mtime
- **用途**: 与 `onlineUpdateDate` 比较，判断是否有新版本

#### `onlineUpdateDate` (mod_status.online_update_date)
- **含义**: mod.io 上该 Mod 最新版本的发布时间戳（毫秒）
- **更新时机**:
  - 调用 `ModUpdateService.updateModInDatabase()` 时，从 mod.io API 获取
  - 调用 `ModUpdateService.checkModUpdate()` 接收到 `MODFILE_CHANGED` 事件时
- **数据来源**: mod.io API 的 `date_updated` 字段（**注意：API 返回秒级时间戳，需 ×1000 转换为毫秒**）

### 1.3 CompleteModData 结构

前端使用的完整 Mod 数据结构：

```typescript
export interface CompleteModData extends ModData {
    version?: ModVersionData;    // 版本信息
    download?: ModDownloadData;  // 下载信息
    status?: ModStatusData;      // 状态信息
}
```

**重要**: 必须使用 `getBatchCompleteModDataOptimized()` 或 `getCompleteModData()` 获取完整数据，不能使用 `getAllMods()`（仅返回基础信息）。

## 2. 时间戳约定

### 2.1 存储标准

**所有数据库字段统一使用毫秒级时间戳（milliseconds）**。

### 2.2 API 时间戳转换

#### mod.io API
- **返回格式**: 秒级 Unix 时间戳
- **需要转换**: ✅ 必须 ×1000 转换为毫秒
- **涉及字段**:
  - `date_updated`: Mod 最后更新时间
  - `date_added`: 事件发生时间

```typescript
// 正确示例
const onlineUpdateDate = modInfo.date_updated * 1000;
```

#### JavaScript Date API
- `Date.now()`: 返回毫秒 ✅ 直接使用
- `fileInfo.mtime.getTime()`: 返回毫秒 ✅ 直接使用

#### TimeUtils
- `TimeUtils.getCurrentTime()`: 返回秒级时间戳 ⚠️ 需要 ×1000 转换

## 3. 版本更新检测逻辑

### 3.1 更新警告显示条件

在 `TreeViewItem.tsx` 的 `checkExpired()` 函数中实现：

```typescript
const checkExpired = () => {
    // 条件1: 仅对 mod.io 类型的 Mod 检测更新
    if (nodeData.sourceType !== ModSourceType.Modio) {
        return false;
    }

    // 条件2: 下载必须完成
    if (nodeData.downloadProgress !== 100) {
        return false;
    }

    // 条件3: 如果用户手动选择了版本，则不提示更新
    // 原因：用户可能故意选择了旧版本（兼容性需求）
    if (nodeData.usedVersion && nodeData.usedVersion !== "") {
        return false;
    }

    // 条件4: 只有在用户未手动选择版本时，才检查在线是否有新版本
    // 如果 lastUpdateDate 为 0，说明是旧数据或初始化数据，不应该显示警告
    const hasNewerOnlineVersion = nodeData.lastUpdateDate > 0 &&
                                  nodeData.onlineUpdateDate > nodeData.lastUpdateDate;

    return hasNewerOnlineVersion;
}
```

**显示橙色时钟图标的条件**：
1. ✅ Mod 来源是 mod.io
2. ✅ 下载进度 = 100%
3. ✅ 用户未手动选择版本（`usedVersion === ""`）
4. ✅ `lastUpdateDate > 0`（非初始化数据）
5. ✅ `onlineUpdateDate > lastUpdateDate`（线上有更新）

### 3.2 更新检测流程

#### 主动检测（`ModUpdateService.checkModUpdate()`）
1. 调用 mod.io Events API 获取最近更新事件
2. 处理 `MODFILE_CHANGED` 事件：
   - 更新 `onlineUpdateDate`（秒转毫秒）
   - 将 `lastUpdateDate` 设为 0（标记为需要更新）
3. 处理 `MOD_UNAVAILABLE` / `MOD_DELETED` 事件：
   - 设置 `isOnlineAvailable = false`

#### 被动检测（启用 Mod 时）
在 `ModUpdateService.checkOnlineModUpdate()` 中：
1. 检查本地文件是否存在
2. 比较 `onlineUpdateDate` 和 `lastUpdateDate`
3. 检查下载进度是否为 100
4. 如果任一条件不满足，触发 `updateMod()`

## 4. 版本管理工作流

### 4.1 初始添加 Mod

**文件**: `src/vm/HomeViewModel.ts` - `addModFromModio()`

**流程**:
```
1. 从 mod.io API 获取 Mod 信息
   ├─ 基础信息（displayName, nameId, url, tags）
   ├─ 版本信息（modfile.version）
   └─ 时间信息（date_updated）

2. 创建数据库记录
   ├─ mods: 基础信息
   ├─ mod_versions: currentVersion = modfile.version
   ├─ mod_downloads: downloadUrl, fileSize, downloadProgress=0
   └─ mod_status:
      ├─ onlineUpdateDate = date_updated * 1000
      └─ lastUpdateDate = 0 (未下载)

3. 启动下载任务（如果用户启用）
   └─ 调用 ModUpdateService.updateModFile()
```

### 4.2 下载 Mod 文件

**文件**: `src/apis/ModUpdateService.ts` - `updateModFile()`

**流程**:
```
1. 调用 ModioApi.downloadModFile()
   └─ 进度回调更新 downloadProgress

2. 下载完成后更新数据库
   ├─ mod_downloads.download_progress = 100
   ├─ mod_versions.current_version = 下载的版本号
   └─ mod_status.last_update_date = onlineUpdateDate
      (标记本地文件与线上版本同步)
```

**关键代码**:
```typescript
// 更新下载进度
await modsApi.updateDownloadProgress(mod.modId!, 100);

// 更新 fileVersion
await modsApi.upsertModVersion({
    modId: mod.modId!,
    currentVersion: mod.version.currentVersion,
    availableVersions: mod.version.availableVersions || []
});

// 更新 lastUpdateDate
await modsApi.upsertModStatus({
    modId: mod.modId!,
    lastUpdateDate: currentStatus.onlineUpdateDate || Date.now()
});
```

### 4.3 手动切换版本

**文件**: `src/pages/HomePage/TreeViewItem.tsx` - `ModTreeViewVersionSelect.onChange()`

**流程**:
```
1. 用户在下拉框选择版本

2. 更新 profile_mods.used_version
   └─ viewModel.setModUsedVersion(profileModId, fileInfo.version)

3. 创建新的 CompleteModData
   ├─ version.currentVersion = 选择的版本
   ├─ download.downloadUrl = 新版本的下载链接
   └─ download.downloadProgress = 0

4. 触发事件更新 UI
   └─ emit("mod-treeview-update" + nodeData.key, updatedModItem)

5. 开始下载新版本
   └─ ModUpdateService.updateModFile(updatedModItem)
```

**关键代码**:
```typescript
const onChange = async (value: string) => {
    const fileInfo = JSON.parse(value);

    // 更新 profile_mods
    if (nodeData.profileModId) {
        await viewModel.setModUsedVersion(nodeData.profileModId, fileInfo.version);
    }

    const modItem = await getModById(nodeData.modId);
    if (!modItem) return;

    // 构造更新后的数据（包含新版本信息）
    const updatedModItem: CompleteModData = {
        ...modItem,
        version: {
            ...modItem.version!,
            currentVersion: fileInfo.version || fileInfo.filename
        },
        download: {
            ...modItem.download!,
            downloadUrl: fileInfo.download.binary_url,
            downloadProgress: 0,
            fileSize: fileInfo.filesize,
        }
    };

    // 更新 UI
    await emit("mod-treeview-update" + nodeData.key, updatedModItem);

    // 下载新版本
    await ModUpdateService.updateModFile(updatedModItem);
}
```

### 4.4 自动更新检测

**文件**: `src/apis/ModUpdateService.ts` - `checkModUpdate()`

**流程**:
```
1. 获取上次检测时间
   └─ profileVM.getActiveProfileLastUpdate()

2. 调用 mod.io Events API
   └─ 获取 updateTime 之后的所有事件

3. 处理事件
   ├─ MODFILE_CHANGED:
   │  ├─ onlineUpdateDate = event.date_added * 1000
   │  └─ lastUpdateDate = 0 (触发更新提示)
   ├─ MOD_UNAVAILABLE / MOD_DELETED:
   │  └─ isOnlineAvailable = false

4. 更新检测时间
   └─ profileVM.setActiveProfileLastUpdate(当前时间)

5. 刷新 UI
   └─ TreeViewModel.updateTreeView()
```

## 5. 用户交互场景

### 场景1: 用户未手动选择版本（使用默认最新版）

**状态**:
- `usedVersion = ""`
- `fileVersion = "1.0.0"`
- `lastUpdateDate = 1766332381423`
- `onlineUpdateDate = 1766332381423`

**行为**:
- ✅ 不显示更新图标（本地与线上同步）

**线上发布新版本后**:
- `onlineUpdateDate = 1766440000000`（新版本时间）
- ✅ **显示橙色时钟图标**（提示有新版本）
- 用户点击"更新"后，自动下载最新版本

---

### 场景2: 用户手动选择了旧版本

**操作**:
用户在版本下拉框选择 `v4.7.0`（当前最新版本是 `v4.8.1`）

**状态**:
- `usedVersion = "4.7.0"`（用户明确选择）
- `fileVersion = "4.7.0"`
- `lastUpdateDate = 1766220000000`
- `onlineUpdateDate = 1766332381423`（最新版时间）

**行为**:
- ❌ **不显示更新图标**（尊重用户选择）
- 原因：用户可能因为兼容性问题需要使用旧版本

---

### 场景3: 用户手动选择后又希望使用最新版

**操作**:
用户在版本下拉框选择最新版本 `v4.8.1`

**状态更新**:
- `usedVersion = "4.8.1"`
- `fileVersion` → `"4.8.1"`（下载完成后）
- `lastUpdateDate` → `onlineUpdateDate`（同步）

**行为**:
- ✅ 下载新版本
- ✅ 下载完成后，不显示更新图标

---

### 场景4: 本地文件类型 Mod

**状态**:
- `sourceType = "Local"`
- `fileVersion = "1.0.0"`

**行为**:
- ❌ 永远不显示更新图标（无法在线检测更新）
- 本地文件修改时，`lastUpdateDate` 会更新为文件的 mtime

## 6. 代码引用

### 6.1 核心文件

| 文件 | 职责 |
|------|------|
| `src/pages/HomePage/TreeViewItem.tsx` | UI 组件：显示 Mod 条目、版本选择、更新警告 |
| `src/pages/HomePage/index.tsx` | 主页面：获取 Mod 列表、初始化 TreeView |
| `src/pages/HomePage/TreeViewConverter.ts` | 数据转换：ProfileTreeItem ↔ AntD TreeView 格式 |
| `src/apis/ModUpdateService.ts` | 更新逻辑：检测更新、下载文件、更新数据库 |
| `src/storage/dao/ModDAO.ts` | 数据访问：CRUD 操作、获取完整 Mod 数据 |
| `src/vm/HomeViewModel.ts` | 业务逻辑：Mod 启用/禁用、版本管理 |

### 6.2 关键函数

#### 更新检测
- `TreeViewItem.tsx:153` - `checkExpired()`: 判断是否显示更新警告
- `ModUpdateService.ts:200` - `checkModUpdate()`: 主动检测线上更新
- `ModUpdateService.ts:114` - `checkOnlineModUpdate()`: 启用 Mod 时检测更新

#### 数据获取
- `HomePage/index.tsx:320` - **必须使用** `getBatchCompleteModDataOptimized()`
- `ModDAO.ts:430` - `getCompleteModData()`: 获取完整 Mod 数据（含关联）
- `ModDAO.ts:92` - `getAllMods()`: ⚠️ 仅返回基础信息，不含 version/download/status

#### 版本管理
- `TreeViewItem.tsx:104` - `onChange()`: 用户手动切换版本
- `ModUpdateService.ts:82` - `updateModFile()`: 下载 Mod 文件
- `HomeViewModel.ts:setModUsedVersion()`: 更新 profile_mods.used_version

#### 数据库更新
- `ModUpdateService.ts:44` - `updateModInDatabase()`: 更新 Mod 信息（含时间戳转换）
- `ModDAO.ts:258` - `upsertModVersion()`: 创建/更新版本信息
- `ModDAO.ts:386` - `upsertModStatus()`: 创建/更新状态信息
