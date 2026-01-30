import {SearchParams, SearchResult, SearchProviderStatus, SearchSource} from './types';

/**
 * 搜索提供者接口
 * 定义了所有搜索源需要实现的方法
 */
export interface ISearchProvider {
    /**
     * 获取搜索源标识
     */
    readonly source: SearchSource;
    
    /**
     * 获取搜索源显示名称
     */
    readonly displayName: string;
    
    /**
     * 获取搜索源图标 (可选)
     */
    readonly icon?: string;
    
    /**
     * 检查搜索源状态
     */
    checkStatus(): Promise<SearchProviderStatus>;
    
    /**
     * 执行搜索
     * @param params 搜索参数
     */
    search(params: SearchParams): Promise<SearchResult>;
    
    /**
     * 获取搜索框占位符文本
     */
    getSearchPlaceholder(): string;
}

/**
 * 搜索提供者注册表
 * 管理所有可用的搜索提供者
 */
export class SearchProviderRegistry {
    private static instance: SearchProviderRegistry;
    private providers: Map<SearchSource, ISearchProvider> = new Map();
    
    private constructor() {}
    
    /**
     * 获取单例实例
     */
    public static getInstance(): SearchProviderRegistry {
        if (!SearchProviderRegistry.instance) {
            SearchProviderRegistry.instance = new SearchProviderRegistry();
        }
        return SearchProviderRegistry.instance;
    }
    
    /**
     * 注册搜索提供者
     */
    public register(provider: ISearchProvider): void {
        this.providers.set(provider.source, provider);
    }
    
    /**
     * 注销搜索提供者
     */
    public unregister(source: SearchSource): void {
        this.providers.delete(source);
    }
    
    /**
     * 获取指定的搜索提供者
     */
    public get(source: SearchSource): ISearchProvider | undefined {
        return this.providers.get(source);
    }
    
    /**
     * 获取所有搜索提供者
     */
    public getAll(): ISearchProvider[] {
        return Array.from(this.providers.values());
    }
    
    /**
     * 获取所有可用的搜索源
     */
    public getSources(): SearchSource[] {
        return Array.from(this.providers.keys());
    }
    
    /**
     * 检查搜索源是否已注册
     */
    public has(source: SearchSource): boolean {
        return this.providers.has(source);
    }
}
