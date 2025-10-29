/**
 * 迁移工具类
 * 提供JSON配置到数据库的映射和转换功能
 */
export class MigrationUtils {

    /**
     * 安全解析JSON字符串
     */
    public static safeParseJson(jsonString: string, defaultValue: any = {}) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON:', error);
            return defaultValue;
        }
    }

}