import { IoC } from '@/core/IoC.ts';
import { StorageAPI } from '@/storage';
import { AppViewModel } from '@/AppViewModel';
import { MigrationBase } from '@/storage/migration';

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
            // Phase 1: Database
            this.currentPhase = InitPhase.Database;
            console.log('[AppInitializer] Initializing database...');
            await IoC.get(StorageAPI);

            // Phase 2: Data Migration
            this.currentPhase = InitPhase.Migration;
            console.log('[AppInitializer] Running data migrations...');
            //await MigrationBase.autoMigrate();

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
}
