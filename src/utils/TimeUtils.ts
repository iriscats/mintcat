/**
 * 时间戳类型标识（用于文档和注释）
 * - TimestampMs: 毫秒时间戳 (JavaScript 标准)
 * - TimestampSec: 秒时间戳 (Unix 标准)
 */
export type TimestampMs = number;
export type TimestampSec = number;

/**
 * 时间戳工具类
 *
 * 设计原则：
 * 1. 统一使用毫秒作为内部存储单位
 * 2. 外部 API（mod.io）使用秒，需要转换
 * 3. JavaScript 文件操作返回毫秒，无需转换
 * 4. 所有时间比较在毫秒下进行
 */
export class TimeUtils {
    // ============ 获取当前时间 ============

    /**
     * 获取当前时间（毫秒）- 推荐使用
     * @returns 当前时间戳（毫秒）
     */
    public static now(): TimestampMs {
        return Date.now();
    }

    /**
     * 获取当前时间（秒）- 用于与外部 API 交互
     * @returns 当前时间戳（秒）
     */
    public static nowSeconds(): TimestampSec {
        return Math.floor(Date.now() / 1000);
    }

    // ============ 单位转换 ============

    /**
     * 秒 → 毫秒 (mod.io API → 数据库存储)
     * @param seconds 秒时间戳
     * @returns 毫秒时间戳
     */
    public static secondsToMs(seconds: TimestampSec): TimestampMs {
        return seconds * 1000;
    }

    /**
     * 毫秒 → 秒 (数据库存储 → mod.io API)
     * @param ms 毫秒时间戳
     * @returns 秒时间戳
     */
    public static msToSeconds(ms: TimestampMs): TimestampSec {
        return Math.floor(ms / 1000);
    }

    // ============ mod.io 专用转换 ============

    /**
     * 从 mod.io API 响应转换时间戳（秒→毫秒）
     * @param dateValue mod.io API 返回的时间值（秒）
     * @returns 毫秒时间戳，如果输入为 undefined 或 0 则返回 0
     */
    public static fromModio(dateValue: number | undefined): TimestampMs {
        if (dateValue === undefined || dateValue === 0) {
            return 0;
        }
        return dateValue * 1000;
    }

    /**
     * 转换为 mod.io API 参数格式（毫秒→秒）
     * @param ms 毫秒时间戳
     * @returns 秒时间戳
     */
    public static toModio(ms: TimestampMs): TimestampSec {
        return Math.floor(ms / 1000);
    }

    // ============ 比较工具 ============

    /**
     * 比较两个时间戳，返回是否 a > b
     * @param a 时间戳 a（毫秒）
     * @param b 时间戳 b（毫秒）
     * @returns a 是否晚于 b
     */
    public static isNewer(a: TimestampMs, b: TimestampMs): boolean {
        return a > b;
    }

    /**
     * 判断是否有更新可用
     * @param onlineDate 在线版本时间戳（毫秒）
     * @param localDate 本地版本时间戳（毫秒）
     * @returns 是否有更新（在线版本更新且本地版本非初始值）
     */
    public static hasUpdate(onlineDate: TimestampMs, localDate: TimestampMs): boolean {
        // localDate 为 0 表示初始数据，不算有更新
        return localDate > 0 && onlineDate > localDate;
    }

    // ============ 格式化 ============

    /**
     * 格式化日期对象为字符串
     * @param date Date 对象
     * @returns 格式化后的日期字符串 (YYYY/MM/DD HH:mm:ss)
     */
    public static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 格式化时间戳为字符串
     * @param ms 毫秒时间戳
     * @returns 格式化后的日期字符串 (YYYY/MM/DD HH:mm:ss)
     */
    public static formatTimestamp(ms: TimestampMs): string {
        return this.formatDate(new Date(ms));
    }
}
