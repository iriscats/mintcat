# Mod ID 与 Platform ID 关系设计

## 概述

本文档详细说明 MintCat 应用中 `modId` (数据库内部ID) 和 `platformId` (平台模组ID) 的设计原理、数据流转、使用场景及其关系。
模组平台后续会支持其他平台，因此 `platformId` 设计为跨平台唯一标识符。

## 1. 核心概念

### 1.1 modId (数据库内部ID)

**定义**: 应用程序数据库的自增主键，用于内部数据关联和查询。

**特性**:
- **类型**: `INTEGER`，自增主键 (`PRIMARY KEY AUTOINCREMENT`)
- **作用域**: 应用程序内部
- **生成方式**: SQLite 自动生成
- **唯一性**: 数据库级别唯一

**代码位置**: `src/storage/db/Schema.ts:72`
```typescript
modId: integer("mod_id").primaryKey({ autoIncrement: true })
```

### 1.2 platformId (平台模组ID)

**定义**: 外部平台（mod.io）的模组ID或本地模组 ID = 0，用于平台交互和去重。

**特性**:
- **类型**: `INTEGER`，非空，默认值为 0
- **作用域**: 跨平台（mod.io API 交互）
- **生成方式**:
  - **在线模组**: 从 mod.io API 的 `id` 字段映射
  - **本地模组**: 固定值 0
- **唯一性**: 普通索引（非唯一，因为本地模组共享 platformId=0）

**代码位置**: `src/storage/db/Schema.ts:73-74`
```typescript
platformId: integer("platform_id").notNull().default(0)
// 普通索引: index("mods_platform_id_idx")
```

### 1.3 ID 类型区分规则

| 模组类型 | platformId 范围 | 生成方式 | 示例 |
|---------|----------------|---------|------|
| **mod.io 模组** | 1 - 999999 | mod.io API 返回的真实 ID | 123456 |
| **本地模组** | 0 | 0 | 0 |

**优势**: 通过 ID 范围可以快速判断模组来源类型，无需查询 `sourceType` 字段。

## 2. 数据流转与映射

### 2.1 在线模组数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                    在线模组数据流转                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. mod.io API 响应                                             │
│  ┌──────────────────────────────────────┐                      │
│  │ {                                     │                      │
│  │   "id": 123456,                       │ ← platformId 来源    │
│  │   "name": "Better Caves",             │                      │
│  │   "name_id": "better-caves",          │                      │
│  │   "summary": "...",                   │                      │
│  │   ...                                 │                      │
│  │ }                                     │                      │
│  └──────────────────────────────────────┘                      │
│                   │                                              │
│                   │ ModMapper.fromModioResponse()               │
│                   ▼                                              │
│  2. 数据映射层                                                   │
│  ┌──────────────────────────────────────┐                      │
│  │ CompleteModData {                    │                      │
│  │   modId: undefined,         ← 待生成  │                      │
│  │   platformId: 123456,       ← 映射    │                      │
│  │   gameId: 1,                          │                      │
│  │   nameId: "better-caves",             │                      │
│  │   displayName: "Better Caves",        │                      │
│  │   ...                                 │                      │
│  │ }                                     │                      │
│  └──────────────────────────────────────┘                      │
│                   │                                              │
│                   │ ModDAO.addMod()                             │
│                   ▼                                              │
│  3. 数据库插入                                                   │
│  ┌──────────────────────────────────────┐                      │
│  │ mods 表                               │                      │
│  │ ┌─────────┬──────────────┬─────────┐ │                      │
│  │ │ modId   │ platformId   │ nameId  │ │                      │
│  │ ├─────────┼──────────────┼─────────┤ │                      │
│  │ │ 1 (自增)│ 123456       │ better..│ │                      │
│  │ └─────────┴──────────────┴─────────┘ │                      │
│  └──────────────────────────────────────┘                      │
│                   │                                              │
│                   ├──────────────┬──────────────┬──────────────┤
│                   ▼              ▼              ▼              ▼
│  4. 关联表                                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  │mod_versions │ │mod_downloads│ │ mod_status  │ │profile_mods││
│  │ modId: 1    │ │ modId: 1    │ │ modId: 1    │ │ modId: 1  ││
│  │ ...         │ │ ...         │ │ ...         │ │ ...       ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键代码**: `src/mappers/ModMapper.ts:20-60`
```typescript
static fromModioResponse(modInfo: any): CompleteModData {
    const dto: CompleteModData = {
        modId: undefined,              // 数据库插入时自动生成
        platformId: modInfo.id,        // mod.io API 的 id 字段
        gameId: 1,                     // DRG 游戏ID
        nameId: modInfo.name_id,
        displayName: modInfo.name,
        url: modInfo.profile_url,
        sourceType: ModSourceType.Modio,
        // ... 其他字段映射
    };
    return dto;
}
```

### 2.2 本地模组数据流

**关键代码**: `src/mappers/ModMapper.ts:66-100`
```typescript
static fromLocalPath(filePath: string, fileName: string): CompleteModData {
    const nameId = fileName.replace(/\.[^/.]+$/, "");

    const dto: CompleteModData = {
        modId: undefined,
        platformId: 0,        // 本地ID = 0
        gameId: 1,
        nameId: nameId,
        displayName: fileName,
        url: filePath,
        sourceType: ModSourceType.Local,
        // ...
    };
    return dto;
}

```

## 3. 使用场景对比

### 3.1 modId 使用场景

#### 3.1.1 数据库关联查询

**所有关联表都使用 modId 作为外键**:

```typescript
// Schema.ts 定义的关联关系
mod_versions  → mods.modId  (一对一)
mod_downloads → mods.modId  (一对一)
mod_status    → mods.modId  (一对一)
profile_mods  → mods.modId  (多对多)
```

**查询示例**:
```typescript
// 获取完整模组数据（包含所有关联表）
const mod = await modsDAO.getCompleteModData(modId);
// 返回: ModData + ModVersion + ModDownload + ModStatus

// 获取模组版本信息
const version = await modsDAO.getModVersionByModId(modId);

// 获取模组下载信息
const download = await modsDAO.getModDownloadByModId(modId);
```

#### 3.1.2 配置文件模组管理

**代码位置**: `src/storage/dao/ProfileDAO.ts`
```typescript
// 向配置文件添加模组
public async addModToProfile(profileId: number, modId: number, folderId?: number) {
    await this.db.insert(profileMods).values({
        profileId: profileId,
        modId: modId,              // 使用 modId 引用
        folderId: folderId,
        installedAt: Date.now(),
    });
}

// 从配置文件移除模组
public async removeModFromProfile(profileId: number, modId: number) {
    await this.db.delete(profileMods).where(
        and(
            eq(profileMods.profileId, profileId),
            eq(profileMods.modId, modId)  // 使用 modId 查询
        )
    );
}
```

#### 3.1.3 模组状态更新

**代码位置**: `src/apis/ModUpdateApi.ts`
```typescript
// 更新模组状态
await modsApi.upsertModStatus({
    modId: mod.modId!,              // 使用 modId
    isOnlineAvailable: true,
    isOnlineUpdateDate: Date.now()
});

// 更新下载进度
await modsApi.upsertModDownload({
    modId: mod.modId!,              // 使用 modId
    downloadProgress: 50,
    downloadStatus: "downloading"
});
```

### 3.2 platformId 使用场景

#### 3.2.1 mod.io API 交互

**场景**: 批量检查模组更新时，需要传递 platformId 列表给 mod.io API。

**代码位置**: `src/apis/ModUpdateApi.ts:251-258`
```typescript
// 收集所有在线模组的 platformId
const modIdList: number[] = [];
for (const mod of allMods) {
    if (mod.sourceType === ModSourceType.Modio) {
        modIdList.push(mod.platformId);  // 使用 platformId
    }
}

// 调用 mod.io API（需要 platformId 参数）
const events = await ModioApi.getEvents(
    updateTime,
    modIdList.join(",")  // "123456,234567,345678"
);
```

**API 响应处理**:
```typescript
// mod.io API 返回的事件中包含 mod_id（对应 platformId）
interface EventInfo {
    mod_id: number;        // 这是 platformId
    event_type: string;
    date_added: number;
    // ...
}
```

#### 3.2.2 事件匹配与同步

**场景**: 将 mod.io 事件与本地模组数据匹配。

**代码位置**: `src/apis/ModUpdateApi.ts:259-290`
```typescript
// 遍历 mod.io 事件
for (const event of events) {
    // 通过 platformId 匹配本地模组
    const mod = allMods.find(m => m.platformId === event.mod_id);
    //                                    ↑              ↑
    //                            本地 platformId  API 返回的 mod_id

    if (mod) {
        // 使用 modId 更新数据库
        await modsApi.upsertModStatus({
            modId: mod.modId!,
            isOnlineUpdateDate: event.date_added * 1000
        });
    }
}
```

#### 3.2.3 模组去重检查

**场景**: 添加模组前检查是否已存在，避免重复添加。

**代码位置**: `src/services/ModService.ts:62-89`
```typescript
public async saveMod(dto: CompleteModData): Promise<ModData | null> {
    // 1. 先通过 platformId 检查
    let savedMod = await modsDAO.getModByPlatformId(dto.platformId);

    // 2. 如果未找到，再通过 url 检查（兜底机制）
    if (!savedMod && dto.url) {
        savedMod = await modsDAO.getModByUrl(dto.url);
    }

    // 3. 确认不存在才插入
    if (!savedMod) {
        savedMod = await modsDAO.addMod(dto);
    }

    return savedMod;
}
```

**DAO 查询方法**: `src/storage/dao/ModDAO.ts:136-146`
```typescript
public async getModByPlatformId(platformId: number): Promise<ModData | null> {
    const result = await this.db
        .select()
        .from(mods)
        .where(eq(mods.platformId, platformId))
        .limit(1);

    return result.length > 0 ? result[0] : null;
}
```

#### 3.2.4 模组来源判断

**通过 platformId 范围快速判断模组类型**:

```typescript
function getModSource(platformId: number): "modio" | "local" {
    return platformId === 0 ? "local" : "modio";
}

// 示例
getModSource(123456)   // "modio"  - mod.io 平台模组
getModSource(0)        // "local"  - 本地模组
```

## 4. 完整工作流示例

### 4.1 模组添加流程

```
用户操作: 添加 mod.io 模组 "Better Caves"
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 1. 获取 mod.io 数据                                         │
│    ModioApi.getMod("better-caves")                         │
│    返回: { id: 123456, name: "Better Caves", ... }         │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 2. 数据映射                                                 │
│    ModMapper.fromModioResponse(modInfo)                    │
│    返回: {                                                  │
│      modId: undefined,                                     │
│      platformId: 123456,     ← 映射 API 的 id             │
│      nameId: "better-caves",                               │
│      ...                                                   │
│    }                                                       │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 去重检查                                                 │
│    ModService.saveMod(dto)                                 │
│    ├─ getModByPlatformId(123456)  ← 使用 platformId 查询  │
│    ├─ 如果存在 → 返回已有记录                              │
│    └─ 如果不存在 → 继续插入                                │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 4. 数据库插入                                               │
│    ModDAO.addMod(dto)                                      │
│    INSERT INTO mods (platform_id, name_id, ...)            │
│    VALUES (123456, 'better-caves', ...)                    │
│                                                             │
│    SQLite 自动生成: modId = 1                              │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 5. 关联数据插入                                             │
│    ├─ ModDAO.upsertModVersion(modId: 1, ...)   ← 使用modId│
│    ├─ ModDAO.upsertModDownload(modId: 1, ...)             │
│    └─ ModDAO.upsertModStatus(modId: 1, ...)               │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 6. 添加到配置文件                                           │
│    ProfileDAO.addModToProfile(profileId, modId: 1)         │
│    INSERT INTO profile_mods (profile_id, mod_id, ...)      │
│    VALUES (1, 1, ...)                      ← 使用 modId    │
└────────────────────────────────────────────────────────────┘
```

### 4.2 模组更新检查流程

```
定时任务: 检查模组更新
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 1. 获取所有已安装模组                                       │
│    ModDAO.getAllMods()                                     │
│    返回: [                                                  │
│      { modId: 1, platformId: 123456, sourceType: "Modio" },│
│      { modId: 2, platformId: 234567, sourceType: "Modio" },│
│      { modId: 3, platformId: 0, sourceType: "Local" }     │
│    ]                                                       │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 2. 筛选在线模组并收集 platformId                            │
│    const modIdList = allMods                               │
│      .filter(m => m.sourceType === "Modio")                │
│      .map(m => m.platformId);                              │
│                                                             │
│    结果: [123456, 234567]    ← 只包含 platformId          │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 调用 mod.io API                                         │
│    ModioApi.getEvents(                                     │
│      lastUpdateTime,                                       │
│      "123456,234567"         ← 传递 platformId 列表       │
│    )                                                       │
│                                                             │
│    返回: [                                                  │
│      {                                                     │
│        mod_id: 123456,       ← mod.io 的模组ID            │
│        event_type: "MODFILE_CHANGED",                     │
│        date_added: 1703123456                              │
│      }                                                     │
│    ]                                                       │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 4. 匹配事件到本地模组                                       │
│    for (const event of events) {                           │
│      // 通过 platformId 匹配                               │
│      const mod = allMods.find(                             │
│        m => m.platformId === event.mod_id                  │
│      );                                                    │
│      //      ↑ 本地          ↑ API返回                     │
│      //      123456          123456                        │
│                                                             │
│      if (mod) {                                            │
│        // 找到对应的本地模组                               │
│        matchedMods.push({ mod, event });                   │
│      }                                                     │
│    }                                                       │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 5. 更新本地数据                                             │
│    for (const { mod, event } of matchedMods) {             │
│      // 使用 modId 更新数据库                              │
│      await modsApi.upsertModStatus({                       │
│        modId: mod.modId!,        ← 使用内部 modId         │
│        isOnlineUpdateDate: event.date_added * 1000         │
│      });                                                   │
│                                                             │
│      // 获取最新版本信息                                   │
│      const latestVersion = await ModioApi.getModFiles(     │
│        mod.platformId          ← 使用 platformId 调用API  │
│      );                                                    │
│                                                             │
│      await modsApi.upsertModVersion({                      │
│        modId: mod.modId!,        ← 使用内部 modId         │
│        availableVersions: latestVersion                    │
│      });                                                   │
│    }                                                       │
└────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────┐
│ 6. 通知 UI 更新                                             │
│    AppViewModel.refreshModList()                           │
│    → HomeViewModel 重新加载模组列表                         │
│    → UI 显示更新标记                                        │
└────────────────────────────────────────────────────────────┘
```

## 5. 核心查询方法对比

### 5.1 DAO 层查询方法

**文件位置**: `src/storage/dao/ModDAO.ts`

| 方法 | 参数 | 用途 | 返回类型 | 使用场景 |
|------|------|------|---------|---------|
| `getModById(modId)` | `modId: number` | 通过内部ID查询 | `ModData \| null` | 应用内部查询 |
| `getModByPlatformId(platformId)` | `platformId: number` | 通过平台ID查询 | `ModData \| null` | 去重检查、API匹配 |
| `getModByUrl(url)` | `url: string` | 通过URL查询 | `ModData \| null` | 去重检查（兜底） |
| `getCompleteModData(modId)` | `modId: number` | 获取完整数据 | `CompleteModData \| null` | 获取模组全部信息 |
| `getAllMods()` | 无 | 获取所有模组 | `ModData[]` | 列表展示、批量操作 |

### 5.2 查询方法实现示例

#### getModById - 内部查询
```typescript
public async getModById(modId: number): Promise<ModData | null> {
    const result = await this.db
        .select()
        .from(mods)
        .where(eq(mods.modId, modId))  // 使用 modId
        .limit(1);

    return result.length > 0 ? result[0] : null;
}
```

#### getModByPlatformId - 平台匹配
```typescript
public async getModByPlatformId(platformId: number): Promise<ModData | null> {
    const result = await this.db
        .select()
        .from(mods)
        .where(eq(mods.platformId, platformId))  // 使用 platformId
        .limit(1);

    return result.length > 0 ? result[0] : null;
}
```

#### getCompleteModData - 完整数据查询
```typescript
public async getCompleteModData(modId: number): Promise<CompleteModData | null> {
    // 1. 查询主表
    const mod = await this.getModById(modId);  // 使用 modId
    if (!mod) return null;

    // 2. 查询关联表（都使用 modId）
    const version = await this.getModVersionByModId(modId);
    const download = await this.getModDownloadByModId(modId);
    const status = await this.getModStatusByModId(modId);

    // 3. 合并数据
    return {
        ...mod,
        currentVersion: version?.currentVersion,
        availableVersions: version?.availableVersions,
        downloadUrl: download?.downloadUrl,
        cachePath: download?.cachePath,
        // ...
    };
}
```

## 6. 关键文件索引

### 6.1 核心文件清单

| 文件路径 | 主要内容 | 关键行号 |
|---------|---------|---------|
| `src/storage/db/Schema.ts` | 数据库 schema 定义 | 72-89 (mods表) |
| `src/mappers/ModMapper.ts` | ID 映射逻辑 | 20-60 (在线), 66-100 (本地) |
| `src/storage/dao/ModDAO.ts` | 数据访问对象 | 106-146 (查询方法) |
| `src/services/ModService.ts` | 业务逻辑层 | 62-89 (去重检查) |
| `src/apis/ModUpdateApi.ts` | mod.io 交互 | 239-296 (更新检查) |
| `src/apis/modio/ModInfo.ts` | API 类型定义 | ModInfo.id 字段 |
| `src/apis/modio/EventInfo.ts` | 事件类型定义 | EventInfo.mod_id 字段 |

### 6.2 关键类型定义

#### ModData (基础模组数据)
```typescript
// src/storage/db/Schema.ts
export interface ModData {
    modId: number;            // 数据库主键
    platformId: number;       // 平台ID或哈希ID
    gameId: number;
    nameId: string;
    displayName: string;
    url: string;
    sourceType: string;       // "Modio" | "Local"
    // ...
}
```

#### CompleteModData (完整模组数据)
```typescript
// src/storage/db/Schema.ts
export interface CompleteModData extends ModData {
    // 版本信息 (from mod_versions)
    currentVersion?: string;
    availableVersions?: any[];

    // 下载信息 (from mod_downloads)
    downloadUrl?: string;
    cachePath?: string;
    fileSize?: number;

    // 状态信息 (from mod_status)
    isOnlineAvailable?: boolean;
    isLocalAvailable?: boolean;
    // ...
}
```

#### ModInfo (mod.io API 响应)
```typescript
// src/apis/modio/ModInfo.ts
export interface ModInfo {
    id: number;               // → platformId
    name: string;
    name_id: string;
    summary: string;
    profile_url: string;
    // ...
}
```

## 7. 设计优势与最佳实践

### 7.1 设计优势

#### 1. 关注点分离
- **modId**: 纯内部数据管理，不受外部影响
- **platformId**: 专注外部集成，变更不影响内部关联

#### 2. 数据一致性
- 主键自增保证唯一性
- URL 唯一索引避免重复
- 外键约束保证引用完整性

#### 3. 性能优化
- modId 作为主键，索引查询极快
- platformId 独立索引，API 匹配高效
- 避免复合主键的查询开销

#### 4. 扩展性
- 易于支持多平台（Steam Workshop, Nexus Mods 等）
- 本地模组通过统一ID = 0无缝集成
- 平台ID规则清晰，易于维护

### 7.2 最佳实践

#### ✅ DO - 推荐做法

```typescript
// ✅ 内部查询使用 modId
const mod = await modsDAO.getModById(modId);

// ✅ API 交互使用 platformId
const events = await ModioApi.getEvents(platformIdList);

// ✅ 去重检查使用 platformId
const existing = await modsDAO.getModByPlatformId(platformId);

// ✅ 数据库关联使用 modId
await profileDAO.addModToProfile(profileId, modId);

// ✅ 先匹配 platformId，再用 modId 操作
const mod = allMods.find(m => m.platformId === event.mod_id);
await modsApi.upsertModStatus({ modId: mod.modId!, ... });
```

#### ❌ DON'T - 避免做法

```typescript
// ❌ 不要在内部关联表中使用 platformId
// 错误: profile_mods 应该用 modId，不是 platformId
await db.insert(profileMods).values({
    profileId: 1,
    platformId: 123456,  // ❌ 错误
});

// ❌ 不要直接用 platformId 查询关联数据
// 错误: 应该先通过 platformId 获取 modId，再查询
const version = await getModVersionByPlatformId(platformId);  // ❌ 错误

// ❌ 不要混用两种ID
// 错误: 参数类型不一致
await modsApi.upsertModStatus({
    modId: platformId,  // ❌ 错误: 混用了两种ID
});

// ❌ 不要假设 platformId 连续
// 错误: platformId 不保证连续性
for (let id = 1; id <= maxPlatformId; id++) {
    const mod = await getModByPlatformId(id);  // ❌ 效率低且不可靠
}
```

### 7.3 ID 选择决策树

```
需要查询/操作模组数据?
           │
           ├─ 是否需要与 mod.io API 交互?
           │         │
           │         ├─ 是 → 使用 platformId
           │         │      (调用API、匹配事件、去重检查)
           │         │
           │         └─ 否 → 是否已知 modId?
           │                  │
           │                  ├─ 是 → 使用 modId
           │                  │      (查询、更新、关联)
           │                  │
           │                  └─ 否 → 先通过其他条件获取 modId
           │                         (url、platformId → modId)
           │
           └─ 需要插入新模组?
                      │
                      └─ 映射 platformId，让数据库生成 modId
                         (在线: API id → platformId)
                         (本地: 0)
```

## 8. 常见问题与解决方案

### Q1: 为什么不直接使用 platformId 作为主键?

**A**: 存在以下问题:
1. **本地模组**: 没有真实的平台ID，需要自行生成
2. **多平台支持**: 不同平台可能有ID冲突
3. **数据迁移**: 平台ID变更会破坏所有外键关联
4. **性能**: 自增主键的插入和索引性能更好

### Q2: 本地模组的 platformId 会冲突吗?

**A**: 不会冲突，本地模组统一使用 platformId = 0

**说明**:
- 所有本地模组共享同一个 platformId = 0
- 通过 modId 和 url 字段区分不同的本地模组
- 不存在哈希冲突问题

### Q3: 如何处理模组迁移或重新添加?

**场景**: 用户删除后重新添加同一个模组

**方案**:
```typescript
// ModService.saveMod 中的去重逻辑
let savedMod = await modsDAO.getModByPlatformId(dto.platformId);
if (savedMod) {
    // 模组已存在，更新信息而非重新插入
    await modsDAO.updateMod(savedMod.modId, dto);
    return savedMod;
}
```

这样可以:
- 保留原有的 modId 和关联关系
- 更新模组的最新信息
- 避免数据重复

### Q4: 能否通过 platformId 判断模组来源?

**A**: 可以，通过 ID 范围快速判断，但是不建议这么做

```typescript
function isLocalMod(platformId: number): boolean {
    return platformId === 0;
}

function isModioMod(platformId: number): boolean {
    return platformId > 0;
}

// 使用示例
if (isLocalMod(mod.platformId)) {
    console.log("这是本地模组");
} else if (isModioMod(mod.platformId)) {
    console.log("这是 mod.io 平台模组");
}
```

## 9. 总结

### 核心原则

1. **内部用 modId**: 所有数据库内部操作、关联查询使用 modId
2. **外部用 platformId**: 所有平台API交互、去重检查使用 platformId
3. **映射在边界**: ID 转换只发生在数据流入/流出边界
4. **单一职责**: 每个 ID 有明确的职责范围，不混用

### ID 关系总结图

```
┌─────────────────────────────────────────────────────────────┐
│                     ID 关系总结                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  platformId (外部标识)                                      │
│  ┌────────────────────────────────────┐                    │
│  │  mod.io 平台: 1-999999              │                    │
│  │  本地模组: = 0                      │                    │
│  └────────────────────────────────────┘                    │
│           │                                                 │
│           │ 数据流入时映射                                   │
│           ▼                                                 │
│  ┌───────────────────────────────────────────────┐         │
│  │         数据库 mods 表                         │         │
│  │  ┌──────────┬──────────────┬─────────────┐   │         │
│  │  │  modId   │  platformId  │  sourceType │   │         │
│  │  │  (主键)   │  (普通索引)   │             │   │         │
│  │  ├──────────┼──────────────┼─────────────┤   │         │
│  │  │  1       │  123456      │  Modio      │   │         │
│  │  │  2       │  234567      │  Modio      │   │         │
│  │  │  3       │  0           │  Local      │   │         │
│  │  └──────────┴──────────────┴─────────────┘   │         │
│  └───────────────────────────────────────────────┘         │
│           │                                                 │
│           │ 内部使用 modId                                   │
│           ▼                                                 │
│  ┌───────────────────────────────────────────────┐         │
│  │            关联表（都使用 modId）              │         │
│  │  ┌────────────────┬────────────────┐         │         │
│  │  │ mod_versions   │ mod_downloads  │         │         │
│  │  │ modId: 1       │ modId: 1       │         │         │
│  │  ├────────────────┼────────────────┤         │         │
│  │  │ mod_status     │ profile_mods   │         │         │
│  │  │ modId: 1       │ modId: 1       │         │         │
│  │  └────────────────┴────────────────┘         │         │
│  └───────────────────────────────────────────────┘         │
│                                                              │
│  使用场景划分:                                               │
│  ├─ modId (内部):                                           │
│  │  · 数据库查询和关联                                       │
│  │  · 配置文件管理                                          │
│  │  · 状态更新                                              │
│  │                                                          │
│  └─ platformId (外部):                                      │
│     · mod.io API 调用                                       │
│     · 事件匹配                                              │
│     · 去重检查                                              │
│     · 模组来源判断                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 设计哲学

- **关注点分离**: 内外分离，各司其职
- **数据一致性**: 主键自增，外键约束
- **可扩展性**: 易于支持多平台
- **性能优化**: 索引优化，查询高效
- **代码清晰**: ID 用途明确，不易混淆
