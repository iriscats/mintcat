import {TreeDataNode} from "antd";
import React from "react";

export function dragAndDrop(nodeInfo: any, treeData: TreeDataNode[]) {
    console.log(`\n========== [DragAndDrop] 拖拽处理开始 ==========`);
    console.log(`[DragAndDrop] 拖拽信息:`, {
        dragKey: nodeInfo.dragNode.key,
        dragTitle: nodeInfo.dragNode.title,
        dropKey: nodeInfo.node.key,
        dropTitle: nodeInfo.node.title,
        dropPosition: nodeInfo.dropPosition,
        dropToGap: nodeInfo.dropToGap
    });
    console.log(`[DragAndDrop] 原始 treeData:`, JSON.stringify(treeData, null, 2));

    const dropKey = nodeInfo.node.key;
    const dragKey = nodeInfo.dragNode.key;
    const dropPos = nodeInfo.node.pos.split('-');
    const dropPosition = nodeInfo.dropPosition - Number(dropPos[dropPos.length - 1]); // the drop position relative to the drop node, inside 0, top -1, bottom 1

    console.log(`[DragAndDrop] 解析结果:`, {
        dropKey,
        dragKey,
        dropPos,
        dropPosition,
        dropToGap: nodeInfo.dropToGap
    });

    // Prevent dragging of default folders (Local and Mod.io)
    // Default folders have IDs: Mod.io=1, Local=2
    if (typeof dragKey === 'string' && dragKey.startsWith('folder-')) {
        const folderId = parseInt(dragKey.split('-')[1]);
        if (folderId === 1 || folderId === 2) {
            console.log(`[DragAndDrop] ⚠️ 阻止拖拽默认文件夹: ${dragKey} (ID=${folderId})`);
            console.log(`========== [DragAndDrop] 拖拽处理完成（原样返回）==========\n`);
            return treeData;
        }
    }

    const loop = (
        data: TreeDataNode[],
        key: React.Key,
        callback: (node: TreeDataNode, i: number, data: TreeDataNode[]) => void,
    ) => {
        for (let i = 0; i < data.length; i++) {
            if (data[i].key === key) {
                return callback(data[i], i, data);
            }
            if (data[i].children) {
                loop(data[i].children!, key, callback);
            }
        }
    };
    const data = [...treeData!];

    // Find dragObject
    let dragObj: TreeDataNode;
    console.log(`[DragAndDrop] 查找拖拽对象: dragKey=${dragKey}`);
    loop(data, dragKey, (item, index, arr) => {
        console.log(`[DragAndDrop] 找到拖拽对象:`, { item: { key: item.key, title: item.title }, index });
        arr.splice(index, 1);
        dragObj = item;
    });
    console.log(`[DragAndDrop] 拖拽对象详情:`, { key: dragObj.key, title: dragObj.title });

    if (!nodeInfo.dropToGap && nodeInfo.node.isLeaf === false) {
        // Drop on the content
        console.log(`[DragAndDrop] 拖拽到节点内容内部: dropKey=${dropKey}`);
        loop(data, dropKey, (item) => {
            console.log(`[DragAndDrop] 找到目标节点:`, { key: item.key, title: item.title, existingChildren: item.children?.length || 0 });
            item.children = item.children || [];
            console.log(`[DragAndDrop] 在目标节点内部插入拖拽对象，当前 children 数量: ${item.children.length}`);
            item.children.unshift(dragObj);
            console.log(`[DragAndDrop] 插入后 children 数量: ${item.children.length}`);
        });
    } else {
        let ar: TreeDataNode[] = [];
        let i: number;
        console.log(`[DragAndDrop] 拖拽到节点间隙: dropPosition=${dropPosition}`);
        loop(data, dropKey, (_item, index, arr) => {
            ar = arr;
            i = index;
            console.log(`[DragAndDrop] 找到目标数组和索引:`, { index, arrayLength: arr.length });
        });
        if (dropPosition === -1) {
            // Drop on the top of the drop node
            console.log(`[DragAndDrop] 在目标节点上方插入，索引: ${i}`);
            ar.splice(i!, 0, dragObj!);
        } else {
            // Drop on the bottom of the drop node
            console.log(`[DragAndDrop] 在目标节点下方插入，索引: ${i! + 1}`);
            ar.splice(i! + 1, 0, dragObj!);
        }
    }

    console.log(`[DragAndDrop] 拖拽后 treeData:`, JSON.stringify(data, null, 2));
    console.log(`========== [DragAndDrop] 拖拽处理完成 ==========\n`);
    return data;
}