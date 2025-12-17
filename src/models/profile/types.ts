/**
 * Profile Tree Types
 *
 * Contains enumerations and type definitions for profile tree structure
 */

/**
 * 树节点类型枚举
 */
export enum ProfileTreeType {
    FOLDER = "folder",
    ITEM = "item"
}

/**
 * 预定义文件夹类型枚举
 */
export enum ProfileTreeGroupType {
    ROOT = 0,
    MODIO = 1,
    LOCAL = 2
}
