import { ProfileTreeItem } from './ProfileTreeItem';
import { ProfileTreeType, ProfileTreeGroupType } from './types';

/**
 * 配置树结构
 * 用于表示配置文件中的 mods 和文件夹层级关系
 *
 * Note: This is a pure data model. All business logic should be in ProfileTreeService.
 */
export class ProfileTree {
    public name: string = "";
    public lastUpdate: number = 0;
    public installTime: number = 0;
    public editTime: number = 0;
    public root: ProfileTreeItem = new ProfileTreeItem(ProfileTreeGroupType.ROOT, ProfileTreeType.FOLDER, "root");

    /**
     * Mod.io 文件夹访问器
     * 通过文件夹名称查找，而不是硬编码 ID
     */
    public get ModioFolder(): ProfileTreeItem | undefined {
        return this.root.children.find(p =>
            p.type === ProfileTreeType.FOLDER &&
            (p.name === "Mod.io" || p.name === "mod.io")
        );
    }

    /**
     * Local 文件夹访问器
     * 通过文件夹名称查找，而不是硬编码 ID
     */
    public get LocalFolder(): ProfileTreeItem | undefined {
        return this.root.children.find(p =>
            p.type === ProfileTreeType.FOLDER &&
            (p.name === "Local" || p.name === "本地")
        );
    }

    public constructor(name: string) {
        this.name = name;
        this.lastUpdate = 0;
    }
}
