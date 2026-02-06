import {TreeDataNode} from "antd";
import React from "react";

export function dragAndDrop(nodeInfo: any, treeData: TreeDataNode[]) {
    const dropKey = nodeInfo.node.key;
    const dragKey = nodeInfo.dragNode.key;
    const dropPos = nodeInfo.node.pos.split('-');
    const dropPosition = nodeInfo.dropPosition - Number(dropPos[dropPos.length - 1]);

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

    let dragObj: TreeDataNode;
    loop(data, dragKey, (item, index, arr) => {
        arr.splice(index, 1);
        dragObj = item;
    });

    // 判断是否拖入文件夹内部
    // 条件：不是拖到间隙，且目标节点是文件夹（非叶子节点）
    if (!nodeInfo.dropToGap && nodeInfo.node.isLeaf === false) {
        loop(data, dropKey, (item) => {
            item.children = item.children || [];
            item.children.unshift(dragObj);
        });
    } else {
        // 拖到节点之间的间隙
        let ar: TreeDataNode[] = [];
        let i: number;
        loop(data, dropKey, (_item, index, arr) => {
            ar = arr;
            i = index;
        });
        
        // 修复：对于第一个节点的上方间隙，dropPosition 是 0 而不是 -1
        // 需要检查是否是根级别的第一个节点且放置在其上方
        const isFirstNodeInParent = i! === 0;
        const isDropBefore = dropPosition === -1 || (isFirstNodeInParent && dropPosition === 0 && nodeInfo.dropPosition === 0);
        
        if (isDropBefore) {
            ar.splice(i!, 0, dragObj!);
        } else {
            ar.splice(i! + 1, 0, dragObj!);
        }
    }

    return data;
}