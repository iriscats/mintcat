/**
 * 迁移工具类
 * 提供JSON配置到数据库的映射和转换功能
 */
export class MigrationUtils {

    /**
     * 转换旧版JSON模组数据到新格式
     */
    public static convertOldModData(oldMod: any, gameId: number) {
        const isUrl = (str: string) => str.startsWith('http');
        
        let sourceType = 'Unknown';
        let platformId = 0;
        let nameId = '';
        let displayName = '';
        let url = '';

        if (isUrl(oldMod.url || '')) {
            sourceType = 'Modio';
            url = oldMod.url;
            
            // 从URL提取平台ID
            const match = url.match(/\/mods\/(\d+)/);
            if (match) {
                platformId = parseInt(match[1]);
            }
            
            nameId = oldMod.nameId || `mod_${platformId}`;
            displayName = oldMod.displayName || oldMod.name || `Mod ${platformId}`;
        } else {
            sourceType = 'Local';
            url = oldMod.url || oldMod.cachePath || '';
            nameId = oldMod.nameId || oldMod.displayName || 'local_mod';
            displayName = oldMod.displayName || oldMod.name || 'Local Mod';
        }

        return {
            platformId,
            gameId,
            nameId,
            displayName,
            url,
            sourceType,
            tags: oldMod.tags || [],
            approvalStatus: oldMod.approvalStatus || 'Sandbox',
            dependModId: oldMod.dependModId || 0
        };
    }


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