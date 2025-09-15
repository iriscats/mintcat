import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationBase } from '@/storage/migration/MigrationBase';
import { ConfigMigrationV2 } from '@/storage/migration/ConfigMigrationV2';
import { ConfigMigrationV3 } from '@/storage/migration/ConfigMigrationV3';
import { ConfigMigrationV4 } from '@/storage/migration/ConfigMigrationV4';
import { MigrationUtils } from '@/storage/migration/MigrationUtils';

/**
 * 配置迁移测试套件
 */
describe('配置迁移测试', () => {

    describe('MigrationUtils', () => {
        it('应该正确转换旧版模组数据', () => {
            const oldMod = {
                url: 'https://mod.io/mods/12345',
                name: 'Test Mod',
                tags: ['test', 'utility'],
                approvalStatus: 'Verified'
            };

            const result = MigrationUtils.convertOldModData(oldMod, 1);
            
            expect(result.platformId).toBe(12345);
            expect(result.sourceType).toBe('Modio');
            expect(result.gameId).toBe(1);
            expect(result.tags).toEqual(['test', 'utility']);
        });

        it('应该正确转换本地模组数据', () => {
            const oldMod = {
                url: '/path/to/mod.pak',
                name: 'Local Mod',
                displayName: 'My Local Mod'
            };

            const result = MigrationUtils.convertOldModData(oldMod, 1);
            
            expect(result.platformId).toBe(0);
            expect(result.sourceType).toBe('Local');
            expect(result.gameId).toBe(1);
            expect(result.url).toBe('/path/to/mod.pak');
        });

        it('应该正确转换旧版设置数据', () => {
            const oldSettings = {
                version: '0.4.0',
                guiTheme: 'Dark',
                language: 'zh-CN',
                cachePath: '/cache',
                configPath: '/config',
                ue4ss: 'UE4SS-Full',
                autoCheckUpdates: false,
                downloadParallelCount: 5
            };

            const result = MigrationUtils.convertOldSettingsData(oldSettings);
            
            expect(result.version).toBe('0.4.0');
            expect(result.guiTheme).toBe('Dark');
            expect(result.language).toBe('zh-CN');
            expect(result.ue4ssVersion).toBe('UE4SS-Full');
            expect(result.downloadParallelCount).toBe(5);
        });

        it('应该安全解析JSON字符串', () => {
            const validJson = '{"test": "value"}';
            const result = MigrationUtils.safeParseJson(validJson);
            expect(result).toEqual({ test: 'value' });

            const invalidJson = '{invalid json}';
            const fallback = { fallback: true };
            const result2 = MigrationUtils.safeParseJson(invalidJson, fallback);
            expect(result2).toEqual(fallback);
        });
    });

    describe('配置迁移类', () => {
        it('应该创建配置迁移实例', () => {
            const v2Migration = new ConfigMigrationV2();
            const v3Migration = new ConfigMigrationV3();
            const v4Migration = new ConfigMigrationV4();

            expect(v2Migration).toBeDefined();
            expect(v3Migration).toBeDefined();
            expect(v4Migration).toBeDefined();
        });
    });

    describe('MigrationBase', () => {
        it('应该提供静态方法', () => {
            expect(typeof MigrationBase.needsMigration).toBe('function');
            expect(typeof MigrationBase.migrateConfig).toBe('function');
            expect(typeof MigrationBase.autoMigrate).toBe('function');
            expect(typeof MigrationBase.validateMigration).toBe('function');
        });
    });
});