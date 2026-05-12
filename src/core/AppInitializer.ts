import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { AppViewModel } from '@/AppViewModel';
import { CloudBackupApi } from '@/apis/mintcat';
import {
    getMintcatApiOriginLanguageFallback,
    getMintcatOriginByPresetId,
    isMintcatApiOriginId,
    normalizeMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from '@/apis/mintcat/urls';
import {
    NETWORK_SERVER_AUTO_ORIGIN_KEY,
    NETWORK_SERVER_MODE_KEY,
    type MintcatServerMode,
    probeOrigin,
    refreshAutoMintcatApiRoutingInBackground,
} from '@/apis/mintcat/routing';
import { CacheApi } from '@/apis/CacheApi';
import { closeDb } from '@/storage/db/Client';
import { setMintcatProxyModeResolved } from '@/services/network';
import { taskQueueAPI, TaskPriority } from 'tauri-plugin-task-queue';

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

            // 应用网络代理设置（使后端下载等请求可走 Clash 等代理）
            await this.applyNetworkProxy();
            await this.applyMintcatProxyMode();

            await this.initApiServerRouting();

            // Clean up orphaned .part files from interrupted downloads
            CacheApi.cleanOrphanedPartFiles().catch(e =>
                console.warn('[AppInitializer] .part cleanup failed:', e)
            );

            // Phase 3: Core ViewModel
            this.currentPhase = InitPhase.CoreViewModel;
            console.log('[AppInitializer] Initializing AppViewModel...');
            await IoC.get(AppViewModel);

            // Complete
            this.currentPhase = InitPhase.Complete;
            console.log('[AppInitializer] Core initialization complete');
            if (this.isMainWindow()) {
                this.submitStartupUpdateCheckTask();
            }
        } catch (error) {
            this.currentPhase = InitPhase.Failed;
            this.error = error instanceof Error ? error : new Error(String(error));
            console.error('[AppInitializer] Initialization failed:', error);
            throw this.error;
        }
    }

    /**
     * 应用启动后提交一次更新检测任务，任务内拉取统一更新清单并写入内存缓存。
     */
    private static submitStartupUpdateCheckTask(): void {
        taskQueueAPI.addTask({
            taskType: 'startup_update_check',
            params: {},
            priority: TaskPriority.Low,
        }).catch((error) => {
            console.warn('[AppInitializer] Failed to submit startup update check task:', error);
        });
    }

    private static isMainWindow(): boolean {
        return getCurrentWindow().label === 'main';
    }

    /**
     * Reset state so that initializeCore() can be retried after a failure.
     * Closes DB connection to release file handle, then clears IoC so that
     * StorageAPI and AppViewModel are re-created on next init.
     */
    static resetForRetry(): void {
        this.currentPhase = InitPhase.NotStarted;
        this.error = null;
        void closeDb();
        IoC.clear();
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

    /**
     * 从 settings 读取 network.proxy 并同步到后端，使下载等请求走 Clash 等代理。
     */
    private static async applyNetworkProxy(): Promise<void> {
        try {
            const settings = await StorageAPI.getSettings();
            const raw = await settings.getNetworkProxy();
            const proxy = raw?.trim() ? raw.trim() : null;
            await invoke('set_network_proxy', { proxy });
        } catch (error) {
            console.warn('[AppInitializer] Failed to apply network proxy:', error);
        }
    }

    /**
     * 从 settings 读取 MintCat 反代模式并写入运行时缓存。
     * 该设置仅影响外部请求是否借助 MintCat /proxy，不影响 MintCat 自身 API。
     */
    private static async applyMintcatProxyMode(): Promise<void> {
        try {
            const settings = await StorageAPI.getSettings();
            setMintcatProxyModeResolved(await settings.getMintcatProxyMode());
        } catch (error) {
            console.warn('[AppInitializer] Failed to apply MintCat proxy mode:', error);
        }
    }

    /**
     * 根据设置解析 MintCat API 源站（手动线路 / 自动探测）。
     */
    private static async initApiServerRouting(): Promise<void> {
        try {
            const settings = await StorageAPI.getSettings();
            const modeRaw = await settings.getValue(NETWORK_SERVER_MODE_KEY);
            const mode: MintcatServerMode = (modeRaw?.trim() as MintcatServerMode) || 'auto';
            const autoCached = (await settings.getValue(NETWORK_SERVER_AUTO_ORIGIN_KEY))?.trim() ?? '';

            const applyLanguageFallback = () => {
                setMintcatApiResolvedOrigin(getMintcatApiOriginLanguageFallback());
            };

            if (isMintcatApiOriginId(mode)) {
                setMintcatApiResolvedOrigin(getMintcatOriginByPresetId(mode));
                return;
            }

            // auto（含历史 custom：设置页已迁移为自动）
            if (autoCached) {
                const normalizedCached = normalizeMintcatApiOrigin(autoCached);
                const probe = await probeOrigin(normalizedCached, 1500);
                if (probe.ok) {
                    setMintcatApiResolvedOrigin(normalizedCached);
                    void refreshAutoMintcatApiRoutingInBackground();
                    return;
                }
                console.warn('[AppInitializer] Cached API origin failed validation:', normalizedCached, probe.error);
            }

            applyLanguageFallback();
            void refreshAutoMintcatApiRoutingInBackground();
        } catch (error) {
            console.warn('[AppInitializer] Failed to init API server routing:', error);
            setMintcatApiResolvedOrigin(getMintcatApiOriginLanguageFallback());
        }
    }
}
