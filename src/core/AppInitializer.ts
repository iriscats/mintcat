import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { AppViewModel } from '@/AppViewModel';
import { MigrationBase } from '@/storage/migration';
import { CloudBackupApi } from '@/apis/mintcat';

/**
 * Application initialization phases
 */
export enum InitPhase {
    NotStarted = 'not_started',
    Database = 'database',
    Migration = 'migration',
    CoreViewModel = 'core_viewmodel',
    Complete = 'complete',
    Failed = 'failed'
}

/**
 * Central application initialization manager
 * Ensures correct startup sequence across all windows
 *
 * @example
 * ```typescript
 * // In main window
 * await AppInitializer.initializeCore();
 *
 * // In secondary window
 * if (!AppInitializer.isCoreReady()) {
 *     await AppInitializer.initializeCore(); // Safe to call multiple times
 * }
 * ```
 */
export class AppInitializer {
    private static currentPhase: InitPhase = InitPhase.NotStarted;
    private static error: Error | null = null;

    /**
     * Initialize application core (database + AppViewModel)
     * Safe to call multiple times - returns existing initialization
     *
     * @throws Error if initialization fails
     *
     * @example
     * ```typescript
     * try {
     *     await AppInitializer.initializeCore();
     *     console.log('App is ready');
     * } catch (error) {
     *     console.error('Initialization failed:', error);
     * }
     * ```
     */
    static async initializeCore(): Promise<void> {
        if (this.currentPhase === InitPhase.Complete) {
            return;
        }

        if (this.currentPhase === InitPhase.Failed) {
            throw this.error || new Error('App initialization failed');
        }

        try {
            const restored = await CloudBackupApi.applyPendingRestore();
            if (restored) {
                console.log('[AppInitializer] Applied pending cloud restore');
            }
            // Phase 1: Database
            this.currentPhase = InitPhase.Database;
            console.log('[AppInitializer] Initializing database...');
            await IoC.get(StorageAPI);

            // Phase 2: Data Migration
            this.currentPhase = InitPhase.Migration;
            console.log('[AppInitializer] Running data migrations...');
            //await MigrationBase.autoMigrate();

            // 一次性修复：清除历史数据中被错误写入的 usedVersion
            // usedVersion 应只在用户手动切换版本时才写入，但旧逻辑在添加 mod 时错误地写入了当前版本
            await this.fixUsedVersionData();

            // Phase 3: Core ViewModel
            this.currentPhase = InitPhase.CoreViewModel;
            console.log('[AppInitializer] Initializing AppViewModel...');
            await IoC.get(AppViewModel);

            // Complete
            this.currentPhase = InitPhase.Complete;
            console.log('[AppInitializer] Core initialization complete');
        } catch (error) {
            this.currentPhase = InitPhase.Failed;
            this.error = error instanceof Error ? error : new Error(String(error));
            console.error('[AppInitializer] Initialization failed:', error);
            throw this.error;
        }
    }

    /**
     * Get current initialization phase
     *
     * @returns Current initialization phase
     *
     * @example
     * ```typescript
     * const phase = AppInitializer.getPhase();
     * if (phase === InitPhase.Complete) {
     *     // App is ready
     * }
     * ```
     */
    static getPhase(): InitPhase {
        return this.currentPhase;
    }

    /**
     * Check if core is ready
     *
     * @returns True if initialization is complete
     *
     * @example
     * ```typescript
     * if (AppInitializer.isCoreReady()) {
     *     // Safe to use AppViewModel and database
     * }
     * ```
     */
    static isCoreReady(): boolean {
        return this.currentPhase === InitPhase.Complete;
    }

    /**
     * 一次性修复 usedVersion 数据
     * 旧逻辑在添加 mod 时错误地将 currentVersion 写入了 usedVersion，
     * 导致所有 mod 都被视为"版本锁定"状态。
     * 通过 settings 表的标记确保只执行一次。
     */
    private static async fixUsedVersionData(): Promise<void> {
        try {
            const settings = await StorageAPI.getSettings();
            const flag = await settings.getValue('fix_used_version_v1');
            if (flag === 'done') {
                return;
            }

            console.log('[AppInitializer] Fixing usedVersion data...');
            const profiles = await StorageAPI.getProfiles();
            const cleared = await profiles.clearAllUsedVersions();
            console.log(`[AppInitializer] Cleared ${cleared} incorrect usedVersion entries`);

            await settings.setValue('fix_used_version_v1', 'done');
        } catch (error) {
            console.error('[AppInitializer] Failed to fix usedVersion data:', error);
        }
    }
}
