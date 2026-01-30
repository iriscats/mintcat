import {
    SearchResultItem,
    SearchParams,
    SearchSource,
    SearchProviderRegistry,
    ISearchProvider,
} from '@/apis/search';
import {CacheApi} from '@/apis/CacheApi';
import {TranslateApi} from '@/apis/TranslateApi';

/**
 * 搜索状态
 */
export interface SearchState {
    /** 搜索结果列表 */
    items: SearchResultItem[];
    /** 是否正在加载 */
    loading: boolean;
    /** 是否有更多数据 */
    hasMore: boolean;
    /** 当前搜索关键词 */
    query: string;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 当前搜索源 */
    currentSource: SearchSource;
    /** 可用的搜索源列表 */
    availableSources: SearchSource[];
    /** 错误信息 */
    error: string | null;
}

/**
 * 初始状态
 */
export const initialSearchState: SearchState = {
    items: [],
    loading: false,
    hasMore: false,
    query: '',
    page: 0,
    pageSize: 30,
    currentSource: SearchSource.MODIO,
    availableSources: [SearchSource.MODIO],
    error: null,
};

/**
 * 搜索 ViewModel
 * 管理搜索页面的状态和业务逻辑
 */
export class SearchViewModel {
    private state: SearchState;
    private listeners: Set<(state: SearchState) => void> = new Set();
    private abortController: AbortController | null = null;
    private imageLoadingQueue: Map<string, Promise<string | undefined>> = new Map();

    constructor() {
        this.state = {...initialSearchState};
        this.initAvailableSources();
    }

    /**
     * 初始化可用的搜索源
     */
    private initAvailableSources(): void {
        const registry = SearchProviderRegistry.getInstance();
        this.state.availableSources = registry.getSources();
        if (this.state.availableSources.length > 0 && !this.state.availableSources.includes(this.state.currentSource)) {
            this.state.currentSource = this.state.availableSources[0];
        }
    }

    /**
     * 获取当前搜索提供者
     */
    private getCurrentProvider(): ISearchProvider | undefined {
        return SearchProviderRegistry.getInstance().get(this.state.currentSource);
    }

    /**
     * 订阅状态变化
     */
    public subscribe(listener: (state: SearchState) => void): () => void {
        this.listeners.add(listener);
        // 立即通知当前状态
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 通知所有订阅者状态变化
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener({...this.state}));
    }

    /**
     * 更新状态
     */
    private setState(partialState: Partial<SearchState>): void {
        this.state = {...this.state, ...partialState};
        this.notifyListeners();
    }

    /**
     * 获取当前状态
     */
    public getState(): SearchState {
        return {...this.state};
    }

    /**
     * 切换搜索源
     */
    public async switchSource(source: SearchSource): Promise<void> {
        if (source === this.state.currentSource) return;

        this.cancelCurrentRequest();
        this.setState({
            currentSource: source,
            items: [],
            page: 0,
            hasMore: false,
            error: null,
        });

        // 如果有查询词，自动重新搜索
        if (this.state.query) {
            await this.search(this.state.query);
        } else {
            await this.loadInitial();
        }
    }

    /**
     * 执行搜索
     */
    public async search(query: string): Promise<void> {
        this.cancelCurrentRequest();
        this.abortController = new AbortController();

        this.setState({
            loading: true,
            query,
            page: 0,
            items: [],
            error: null,
        });

        try {
            const provider = this.getCurrentProvider();
            if (!provider) {
                throw new Error('No search provider available');
            }

            const params: SearchParams = {
                query,
                page: 0,
                pageSize: this.state.pageSize,
            };

            const result = await provider.search(params);

            // 检查请求是否被取消
            if (this.abortController?.signal.aborted) return;

            this.setState({
                items: result.items,
                hasMore: result.hasMore,
                loading: false,
            });

            // 异步加载图片缓存
            this.loadImagesAsync(result.items);
        } catch (error) {
            if (this.abortController?.signal.aborted) return;

            this.setState({
                loading: false,
                error: String(error),
            });
        }
    }

    /**
     * 加载初始数据
     */
    public async loadInitial(): Promise<void> {
        await this.search('');
    }

    /**
     * 加载更多数据
     */
    public async loadMore(): Promise<void> {
        if (this.state.loading || !this.state.hasMore) return;

        const nextPage = this.state.page + 1;
        this.setState({loading: true});

        try {
            const provider = this.getCurrentProvider();
            if (!provider) {
                throw new Error('No search provider available');
            }

            const params: SearchParams = {
                query: this.state.query,
                page: nextPage,
                pageSize: this.state.pageSize,
            };

            const result = await provider.search(params);

            this.setState({
                items: [...this.state.items, ...result.items],
                page: nextPage,
                hasMore: result.hasMore,
                loading: false,
            });

            // 异步加载图片缓存
            this.loadImagesAsync(result.items);
        } catch (error) {
            this.setState({
                loading: false,
                error: String(error),
            });
        }
    }

    /**
     * 刷新数据
     */
    public async refresh(): Promise<void> {
        await this.search(this.state.query);
    }

    /**
     * 重置搜索
     */
    public async reset(): Promise<void> {
        this.cancelCurrentRequest();
        this.setState({
            ...initialSearchState,
            currentSource: this.state.currentSource,
            availableSources: this.state.availableSources,
        });
        await this.loadInitial();
    }

    /**
     * 取消当前请求
     */
    private cancelCurrentRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * 异步加载并缓存图片
     * 使用批量处理提高性能
     */
    private async loadImagesAsync(items: SearchResultItem[]): Promise<void> {
        // 使用并发控制，同时只加载有限数量的图片
        const concurrencyLimit = 5;
        const queue = [...items];

        const processItem = async (item: SearchResultItem): Promise<void> => {
            try {
                // 缓存缩略图
                if (item.thumbnailUrl && !item.cachedThumbnailUrl) {
                    const cached = await this.cacheImageWithQueue(item.thumbnailUrl);
                    if (cached) {
                        item.cachedThumbnailUrl = cached;
                    }
                }

                // 缓存头像
                if (item.author.avatarUrl && !item.author.cachedAvatarUrl) {
                    const cached = await this.cacheImageWithQueue(item.author.avatarUrl);
                    if (cached) {
                        item.author.cachedAvatarUrl = cached;
                    }
                }

                // 更新状态以触发重新渲染
                this.notifyListeners();
            } catch (error) {
                // 忽略单个图片加载错误
                console.debug('Failed to cache image:', error);
            }
        };

        // 并发处理
        const workers = Array(concurrencyLimit)
            .fill(null)
            .map(async () => {
                while (queue.length > 0) {
                    const item = queue.shift();
                    if (item) {
                        await processItem(item);
                    }
                }
            });

        await Promise.all(workers);
    }

    /**
     * 使用队列缓存图片，避免重复请求
     */
    private async cacheImageWithQueue(url: string): Promise<string | undefined> {
        // 检查是否已有相同请求在进行中
        if (this.imageLoadingQueue.has(url)) {
            return this.imageLoadingQueue.get(url);
        }

        // 创建新的缓存请求
        const promise = CacheApi.cacheImage(url);
        this.imageLoadingQueue.set(url, promise);

        try {
            const result = await promise;
            return result;
        } finally {
            // 请求完成后从队列移除
            this.imageLoadingQueue.delete(url);
        }
    }

    /**
     * 翻译指定项目
     */
    public async translateItem(itemId: string): Promise<void> {
        const item = this.state.items.find((i) => i.id === itemId);
        if (!item) return;

        try {
            const [nameTrans, summaryTrans] = await Promise.all([
                TranslateApi.translate(item.name),
                TranslateApi.translate(item.summary),
            ]);

            item.nameTrans = nameTrans;
            item.summaryTrans = summaryTrans;
            this.notifyListeners();
        } catch (error) {
            console.error('Translation failed:', error);
        }
    }

    /**
     * 恢复原始文本
     */
    public restoreItem(itemId: string): void {
        const item = this.state.items.find((i) => i.id === itemId);
        if (!item) return;

        item.nameTrans = undefined;
        item.summaryTrans = undefined;
        this.notifyListeners();
    }

    /**
     * 获取搜索占位符
     */
    public getSearchPlaceholder(): string {
        const provider = this.getCurrentProvider();
        return provider?.getSearchPlaceholder() || 'Search...';
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        this.cancelCurrentRequest();
        this.listeners.clear();
        this.imageLoadingQueue.clear();
    }
}

// 单例实例
let searchViewModelInstance: SearchViewModel | null = null;

/**
 * 获取 SearchViewModel 单例
 */
export function getSearchViewModel(): SearchViewModel {
    if (!searchViewModelInstance) {
        searchViewModelInstance = new SearchViewModel();
    }
    return searchViewModelInstance;
}

/**
 * 重置 SearchViewModel 单例
 */
export function resetSearchViewModel(): void {
    if (searchViewModelInstance) {
        searchViewModelInstance.dispose();
        searchViewModelInstance = null;
    }
}
