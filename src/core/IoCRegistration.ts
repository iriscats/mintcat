import { IoC } from '@/core/IoC.ts';
import { AppViewModel } from '@/AppViewModel';
import { TreeViewModel } from '@/pages/HomePage/TreeViewModel';
import { HomeViewModel } from '@/pages/HomePage/HomeViewModel';

/**
 * Register all ViewModels to DI container
 *
 * This function should be called early in the application lifecycle,
 * before any ViewModels are accessed.
 *
 * @example
 * ```typescript
 * // In App.tsx
 * React.useEffect(() => {
 *     registerViewModels();
 *     AppInitializer.initializeCore();
 * }, []);
 * ```
 */
export function registerViewModels(): void {
    // Core ViewModel - shared across windows
    IoC.register(
        'AppViewModel',
        async () => await AppViewModel.getInstance()
    );

    // UI ViewModels - per-window instances
    // Note: These are registered but not initialized until accessed
    IoC.register(
        'TreeViewModel',
        async () => await TreeViewModel.getInstance()
    );

    IoC.register(
        'HomeViewModel',
        async () => await HomeViewModel.getInstance()
    );
}
