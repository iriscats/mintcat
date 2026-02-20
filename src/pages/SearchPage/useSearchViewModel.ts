import {useState, useEffect, useCallback, useRef} from 'react';
import {SearchViewModel, SearchState, SearchSortBy, SearchSortOrder, getSearchViewModel} from './SearchViewModel';
import {SearchSource} from '@/apis/search';

/**
 * 自定义 Hook：使用 SearchViewModel
 * 提供响应式的搜索状态和操作方法
 */
export function useSearchViewModel() {
    const viewModelRef = useRef<SearchViewModel | null>(null);
    const [state, setState] = useState<SearchState | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // 初始化 ViewModel
    useEffect(() => {
        viewModelRef.current = getSearchViewModel();
        
        // 订阅状态变化
        const unsubscribe = viewModelRef.current.subscribe((newState) => {
            setState(newState);
        });

        setIsInitialized(true);

        return () => {
            unsubscribe();
        };
    }, []);

    // 搜索方法（带防抖）
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const search = useCallback((query: string, debounceMs = 300) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (debounceMs > 0) {
            searchTimeoutRef.current = setTimeout(() => {
                viewModelRef.current?.search(query);
            }, debounceMs);
        } else {
            viewModelRef.current?.search(query);
        }
    }, []);

    // 立即搜索（不防抖）
    const searchImmediate = useCallback((query: string) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        viewModelRef.current?.search(query);
    }, []);

    // 加载初始数据
    const loadInitial = useCallback(() => {
        return viewModelRef.current?.loadInitial();
    }, []);

    // 加载更多
    const loadMore = useCallback(() => {
        return viewModelRef.current?.loadMore();
    }, []);

    // 刷新
    const refresh = useCallback(() => {
        return viewModelRef.current?.refresh();
    }, []);

    // 重置
    const reset = useCallback(() => {
        return viewModelRef.current?.reset();
    }, []);

    // 切换搜索源
    const switchSource = useCallback((source: SearchSource) => {
        return viewModelRef.current?.switchSource(source);
    }, []);

    // 翻译项目
    const translateItem = useCallback((itemId: string) => {
        return viewModelRef.current?.translateItem(itemId);
    }, []);

    // 恢复原文
    const restoreItem = useCallback((itemId: string) => {
        viewModelRef.current?.restoreItem(itemId);
    }, []);

    // 获取搜索占位符
    const getSearchPlaceholder = useCallback(() => {
        return viewModelRef.current?.getSearchPlaceholder() || 'Search...';
    }, []);

    // 刷新可用的搜索源（按当前游戏过滤），返回 Promise 便于在首次加载前 await
    const refreshAvailableSources = useCallback((): Promise<void> | undefined => {
        return viewModelRef.current?.refreshAvailableSources();
    }, []);

    // 设置排序
    const setSort = useCallback((sortBy: SearchSortBy, sortOrder: SearchSortOrder) => {
        return viewModelRef.current?.setSort(sortBy, sortOrder);
    }, []);

    // 清理
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return {
        state,
        isInitialized,
        search,
        searchImmediate,
        loadInitial,
        loadMore,
        refresh,
        reset,
        switchSource,
        setSort,
        translateItem,
        restoreItem,
        getSearchPlaceholder,
        refreshAvailableSources,
    };
}

/**
 * 自定义 Hook：防抖输入
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
