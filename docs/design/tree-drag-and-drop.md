# 树节点拖拽系统设计文档

## 概述

本文档描述了 MintCat 应用中 Mod 树视图的拖拽排序功能的技术架构和数据流程。

## 核心组件

### 1. UI 层组件

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| TreeView | `src/pages/HomePage/TreeView.tsx` | Ant Design Tree 组件封装，处理拖拽事件 |
| DragAndDropTree | `src/pages/HomePage/DragAndDropTree.ts` | 拖拽逻辑处理，更新树形数据结构 |
| TreeViewConverter | `src/pages/HomePage/TreeViewConverter.ts` | 数据格式转换器 |

### 2. 数据层组件

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| ProfileTreeItem | `src/models/profile/ProfileTreeItem.ts` | 树节点数据模型 |
| ProfileTreeService | `src/services/ProfileTreeService.ts` | 树数据的加载和保存 |
| ProfileDAO | `src/storage/dao/ProfileDAO.ts` | 数据库访问层 |

## 数据模型

### ProfileTreeItem

```typescript
class ProfileTreeItem {
    id: number;           // 节点 ID（mod ID 或 folder ID）
    type: ProfileTreeType; // 节点类型：ITEM（mod）或 FOLDER
    name: string;         // 节点名称（仅文件夹有值）
    children: ProfileTreeItem[]; // 子节点列表
    enabled: boolean;     // 是否启用（仅 mod 有效）
    usedVersion: string;  // 使用的版本（仅 mod 有效）
}
```

### AntD TreeView 数据格式

```typescript
interface TreeDataNode {
    key: string;          // 节点唯一标识，格式：'mod-{id}' 或 'folder-{id}'
    title: string;        // 显示标题
    isLeaf: boolean;      // 是否为叶子节点
    children?: TreeDataNode[]; // 子节点
    // ... 其他 mod 相关属性
}
```

### 数据库表结构

#### profile_folders 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| profile_id | INTEGER | 所属配置 ID |
| parent_folder_id | INTEGER | 父文件夹 ID |
| name | TEXT | 文件夹名称 |
| folder_type | TEXT | 文件夹类型：'default' 或 'custom' |
| sort_order | INTEGER | 排序顺序 |

#### profile_mods 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| profile_id | INTEGER | 所属配置 ID |
| mod_id | INTEGER | Mod ID |
| parent_folder_id | INTEGER | 所属文件夹 ID |
| sort_order | INTEGER | 排序顺序 |
| is_enabled | BOOLEAN | 是否启用 |
| used_version | TEXT | 使用的版本 |

## 拖拽流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户拖拽 Mod 节点                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. TreeView.onDrop()                                                        │
│     - 接收 Ant Design Tree 的拖拽事件                                         │
│     - 获取当前 treeData                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. dragAndDrop()                                                            │
│     - 解析拖拽信息（dragKey, dropKey, dropPosition）                          │
│     - 从原位置移除拖拽节点                                                     │
│     - 插入到目标位置                                                          │
│     - 返回更新后的 treeData                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. TreeViewConverter.convertFrom()                                          │
│     - 将 AntD TreeView 格式转换为 ProfileTreeItem                             │
│     - 保留节点的 enabled 和 usedVersion 属性                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. ProfileViewModel.saveProfileTreeToDatabase()                             │
│     - 调用 ProfileTreeService.saveProfileTree()                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. ProfileTreeService.saveProfileTree()                                     │
│     - 删除所有自定义文件夹（保留默认文件夹）                                    │
│     - 删除所有 mod 关联                                                       │
│     - 重新创建文件夹和 mod 关联，按顺序分配 sortOrder                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. HomePage.updateTreeView()                                                │
│     - 重新加载树数据                                                          │
│     - 保持展开状态（通过文件夹名称映射）                                        │
│     - 更新 UI                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 详细实现

### 1. 拖拽事件处理 (TreeView.onDrop)

```typescript
// src/pages/HomePage/TreeView.tsx
private async onDrop(info: any) {
    // 1. 获取当前树数据
    const treeData = this.props.treeData || [];

    // 2. 执行拖拽逻辑
    const dragTreeData = dragAndDrop(info, treeData);

    // 3. 转换为 ProfileTreeItem
    const converter = new TreeViewConverter(modList);
    const profileTreeItem = converter.convertFrom(dragTreeData);

    // 4. 保存到数据库
    await profileVM.saveProfileTreeToDatabase(profileTreeItem);

    // 5. 刷新视图
    await this.props.onUpdateTreeView();
}
```

### 2. 拖拽逻辑 (dragAndDrop)

```typescript
// src/pages/HomePage/DragAndDropTree.ts
export function dragAndDrop(nodeInfo: any, treeData: TreeDataNode[]) {
    const dropKey = nodeInfo.node.key;
    const dragKey = nodeInfo.dragNode.key;
    const dropPosition = /* 计算相对位置 */;

    // 阻止拖拽默认文件夹
    if (isDefaultFolder(dragKey)) {
        return treeData;
    }

    // 从原位置移除
    let dragObj: TreeDataNode;
    loop(data, dragKey, (item, index, arr) => {
        arr.splice(index, 1);
        dragObj = item;
    });

    // 插入到目标位置
    if (!nodeInfo.dropToGap && nodeInfo.node.isLeaf === false) {
        // 拖入文件夹内部
        loop(data, dropKey, (item) => {
            item.children.unshift(dragObj);
        });
    } else {
        // 拖到节点间隙
        loop(data, dropKey, (item, index, arr) => {
            if (dropPosition === -1) {
                arr.splice(index, 0, dragObj);
            } else {
                arr.splice(index + 1, 0, dragObj);
            }
        });
    }

    return data;
}
```

### 3. 数据格式转换 (TreeViewConverter)

#### ProfileTreeItem → AntD TreeView

```typescript
// src/pages/HomePage/TreeViewConverter.ts
public convertToFromRoot(root: ProfileTreeItem): TreeProps['treeData'] {
    // 遍历 ProfileTreeItem.children
    // 为每个节点生成 key: 'mod-{id}' 或 'folder-{id}'
    // 递归处理子节点
}
```

#### AntD TreeView → ProfileTreeItem

```typescript
public convertFrom(treeData: any): ProfileTreeItem {
    // 遍历 treeData
    // 从 key 中提取 ID
    // 保留 enabled 和 usedVersion 属性
    // 递归处理子节点
}
```

### 4. 保存到数据库 (ProfileTreeService.saveProfileTree)

```typescript
// src/services/ProfileTreeService.ts
public async saveProfileTree(root: ProfileTreeItem, profileId: number) {
    // 1. 获取默认文件夹 ID（mod.io, 本地）
    const modioFolderId = await profileDAO.getProfileFolderIdByType(profileId, 'modio');
    const localFolderId = await profileDAO.getProfileFolderIdByType(profileId, 'local');

    // 2. 删除所有自定义文件夹
    await profileDAO.deleteCustomFolders(profileId);

    // 3. 删除所有 mod 关联
    await profileDAO.deleteAllProfileMods(profileId);

    // 4. 重新创建文件夹和 mod 关联
    for (let i = 0; i < root.children.length; i++) {
        const item = root.children[i];
        if (item.type === ProfileTreeType.FOLDER) {
            if (isDefaultFolder(item)) {
                // 保存默认文件夹内容
                await this.saveDefaultFolderItems(item, profileDAO, profileId, folderId);
            } else {
                // 创建自定义文件夹
                const folder = await profileDAO.createFolder({
                    profileId,
                    name: item.name,
                    sortOrder: i
                });
                // 递归保存子项
                await this.saveProfileTreeItems(item.children, profileDAO, profileId, folder.id, 0);
            }
        }
    }
}
```

### 5. 从数据库加载 (ProfileTreeService.loadProfileTreeRoot)

```typescript
// src/services/ProfileTreeService.ts
public async loadProfileTreeRoot(profileData: ProfileData): Promise<ProfileTreeItem> {
    // 1. 获取树数据
    const treeData = await profiles.getProfileTree(profileData.id);

    // 2. 构建树结构
    for (const folder of treeData.folders) {
        await this.addFolderToTree(root, folder, allMods, allModData);
    }

    return root;
}
```

## 展开状态保持

### 问题

当保存树数据时，自定义文件夹会被删除并重新创建，导致文件夹 ID 变化。
例如：`folder-1` 变为 `folder-8`，但 `expandedKeys` 仍然是 `['folder-1']`。

### 解决方案

在 `HomePage.updateTreeView()` 中：

1. **保存前**：记录展开文件夹的**名称**（而非 ID）
2. **加载后**：根据名称重新映射到新的文件夹 ID

```typescript
// src/pages/HomePage/index.tsx
async updateTreeView() {
    // 1. 保存展开的文件夹名称
    const expandedFolderNames = this.getExpandedFolderNames();

    // 2. 重新加载树数据
    const profileTree = await profileTreeService.loadProfileTreeRoot(...);
    const converter = new TreeViewConverter(...);

    // 3. 根据名称重建 expandedKeys
    const newExpandedKeys = this.reconstructExpandedKeys(expandedFolderNames, converter.treeData);

    // 4. 更新状态
    this.setState({
        treeData: converter.treeData,
        expandedKeys: newExpandedKeys,
    });
}
```

## 排序顺序保持

### 问题

`ProfileTreeItem.add()` 方法使用 `unshift()` 将新节点添加到数组开头，
导致从数据库加载时（已按 sortOrder 排序）节点顺序被反转。

### 解决方案

将 `unshift()` 改为 `push()`：

```typescript
// src/models/profile/ProfileTreeItem.ts
public add(...): void {
    // 修改前：this.children.unshift(new ProfileTreeItem(...));
    this.children.push(new ProfileTreeItem(...));  // 修改后
}
```

## 默认文件夹处理

### 默认文件夹类型

| 名称 | folder_type | 说明 |
|------|-------------|------|
| mod.io | modio | 从 mod.io 下载的 mod |
| 本地 | local | 本地导入的 mod |

### 特殊处理

1. **不可拖拽**：默认文件夹不能被拖拽移动
2. **不可删除**：保存时保留默认文件夹，只删除自定义文件夹
3. **内容可编辑**：默认文件夹内的 mod 可以拖拽排序

## 日志追踪

关键日志标记：

| 标记 | 说明 |
|------|------|
| `[TreeView] onDrop` | 拖拽事件开始/结束 |
| `[DragAndDrop]` | 拖拽逻辑处理 |
| `[ProfileTreeService] saveProfileTree` | 保存树数据 |
| `[ProfileTreeService] loadProfileTreeRoot` | 加载树数据 |
| `[ProfileTreeService] addFolderToTree` | 添加文件夹到树 |

## 相关文件

- `src/pages/HomePage/TreeView.tsx` - 树视图组件
- `src/pages/HomePage/DragAndDropTree.ts` - 拖拽逻辑
- `src/pages/HomePage/TreeViewConverter.ts` - 数据转换器
- `src/pages/HomePage/index.tsx` - 主页组件，包含 updateTreeView
- `src/models/profile/ProfileTreeItem.ts` - 树节点模型
- `src/services/ProfileTreeService.ts` - 树数据服务
- `src/storage/dao/ProfileDAO.ts` - 数据库访问层
