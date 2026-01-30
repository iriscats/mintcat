// 类型导出
export type {
    SearchResultItem,
    SearchParams,
    SearchResult,
    SearchProviderStatus,
} from './types';

export {SearchSource} from './types';

// 接口导出
export type {ISearchProvider} from './ISearchProvider';
export {SearchProviderRegistry} from './ISearchProvider';

// 提供者实现导出
export {ModioSearchProvider, getModioSearchProvider} from './ModioSearchProvider';

// 初始化搜索提供者注册
import {SearchProviderRegistry} from './ISearchProvider';
import {getModioSearchProvider} from './ModioSearchProvider';

/**
 * 初始化并注册所有搜索提供者
 */
export function initializeSearchProviders(): void {
    const registry = SearchProviderRegistry.getInstance();
    
    // 注册 mod.io 搜索提供者
    registry.register(getModioSearchProvider());
    
    // 未来可以在这里添加更多搜索提供者
    // registry.register(getNexusModsSearchProvider());
    // registry.register(getThunderstoreSearchProvider());
}
