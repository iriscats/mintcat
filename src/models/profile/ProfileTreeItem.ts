import { ProfileTreeType } from './types';

/**
 * 配置树节点
 * 表示树中的一个 item（可以是 mod 或文件夹）
 */
export class ProfileTreeItem {
    public id: number = 0;
    public type: ProfileTreeType = ProfileTreeType.ITEM;
    public name: string = "";
    public children: ProfileTreeItem[] = [];

    public constructor(id: number, type: ProfileTreeType, name: string = "") {
        this.id = id;
        this.type = type;
        this.name = name;
    }

    /**
     * 添加子节点
     */
    public add(id: number, type: ProfileTreeType, name: string = ""): void {
        this.children.unshift(new ProfileTreeItem(id, type, name));
    }

    /**
     * 移除指定 ID 的节点（递归）
     */
    public remove(id: number): void {
        this.children = this.children.filter(m => m.id !== id);
        for (const child of this.children) {
            child.remove(id);
        }
    }
}
