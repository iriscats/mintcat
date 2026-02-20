import React, {useEffect, useCallback, useState, useMemo, useRef} from 'react';
import {
    Button,
    Flex,
    Skeleton,
    Select,
    Empty,
    Spin,
    message,
} from 'antd';
import {HomeOutlined, ReloadOutlined} from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';
import Search from 'antd/es/input/Search';
import {t} from 'i18next';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {SearchResultCard} from './SearchResultCard';
import {useSearchViewModel} from './useSearchViewModel';
import type {SearchSortBy, SearchSortOrder} from './SearchViewModel';
import {SearchSource, initializeSearchProviders} from '@/apis/search';
import {AddModType} from '@/dialogs/AddModDialog';
import {openWindow} from '@/dialogs/AddModDialog/open';
import './styles.css';

// mod.io 排序选项：value 为 sortBy_sortOrder，便于与 state 同步
const MODIO_SORT_OPTIONS: { value: string; sortBy: SearchSortBy; sortOrder: SearchSortOrder }[] = [
    { value: 'date_desc', sortBy: 'date', sortOrder: 'desc' },
    { value: 'downloads_desc', sortBy: 'downloads', sortOrder: 'desc' },
    { value: 'rating_desc', sortBy: 'rating', sortOrder: 'desc' },
    { value: 'name_asc', sortBy: 'name', sortOrder: 'asc' },
    { value: 'name_desc', sortBy: 'name', sortOrder: 'desc' },
];

// 搜索源显示名称映射
const sourceDisplayNames: Record<SearchSource, string> = {
    [SearchSource.MODIO]: 'mod.io',
    [SearchSource.MODCAT]: 'ModCat',
    [SearchSource.NEXUSMODS]: 'Nexus Mods',
    [SearchSource.THUNDERSTORE]: 'Thunderstore',
    [SearchSource.LOCAL]: 'Local',
};

/**
 * 搜索页面组件
 * 支持多搜索源的 mod 搜索和浏览
 */
export function SearchPage() {
    const {
        state,
        isInitialized,
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
    } = useSearchViewModel();

    const [searchValue, setSearchValue] = useState('');
    const [containerHeight, setContainerHeight] = useState(window.innerHeight - 81);
    const containerRef = useRef<HTMLDivElement>(null);

    // 初始化搜索提供者，并按当前游戏刷新可用源后再做首次加载（避免 RC 时仍用 mod.io）
    useEffect(() => {
        initializeSearchProviders();
        let cancelled = false;
        Promise.resolve(refreshAvailableSources()).then(() => {
            if (!cancelled) loadInitial();
        });
        return () => {
            cancelled = true;
        };
    }, [refreshAvailableSources, loadInitial]);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setContainerHeight(window.innerHeight - 81);
        };

        // 使用 Tauri 的窗口事件
        let unlisten: (() => void) | undefined;
        getCurrentWindow()
            .onResized(() => {
                handleResize();
            })
            .then((fn) => {
                unlisten = fn;
            });

        // 同时监听浏览器 resize 事件作为备选
        window.addEventListener('resize', handleResize);

        return () => {
            unlisten?.();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // 处理搜索
    const handleSearch = useCallback(
        (value: string) => {
            setSearchValue(value);
            searchImmediate(value);
        },
        [searchImmediate]
    );

    // 处理输入变化
    const handleSearchInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchValue(e.target.value);
        },
        []
    );

    // 处理重置（点击首页按钮）
    const handleReset = useCallback(async () => {
        setSearchValue('');
        await reset();
    }, [reset]);

    // 处理刷新
    const handleRefresh = useCallback(async () => {
        await refresh();
    }, [refresh]);

    // 处理搜索源切换
    const handleSourceChange = useCallback(
        (value: SearchSource) => {
            switchSource(value);
        },
        [switchSource]
    );

    // 处理 mod.io 排序变更
    const handleSortChange = useCallback(
        (value: string) => {
            const option = MODIO_SORT_OPTIONS.find((o) => o.value === value);
            if (option) setSort(option.sortBy, option.sortOrder);
        },
        [setSort]
    );

    // 处理添加 mod
    const handleAdd = useCallback(async (profileUrl: string) => {
        try {
            await openWindow(AddModType.ONLINE, 0, profileUrl);
        } catch (error) {
            console.error('Failed to open add mod dialog:', error);
            message.error(t('Add Mod Error'));
        }
    }, []);

    // 处理翻译
    const handleTranslate = useCallback(
        (itemId: string) => {
            translateItem(itemId);
        },
        [translateItem]
    );

    // 处理恢复原文
    const handleRestore = useCallback(
        (itemId: string) => {
            restoreItem(itemId);
        },
        [restoreItem]
    );

    // 搜索源选项（用于下拉框）
    const sourceOptions = useMemo(() => {
        return (state?.availableSources || [SearchSource.MODIO]).map((source) => ({
            value: source,
            label: sourceDisplayNames[source] || source,
        }));
    }, [state?.availableSources]);

    // 搜索占位符
    const placeholder = useMemo(() => {
        return getSearchPlaceholder();
    }, [getSearchPlaceholder, state?.currentSource]);

    // 加载状态
    const isLoading = state?.loading ?? true;
    const items = state?.items ?? [];
    const hasMore = state?.hasMore ?? false;

    // 渲染加载骨架屏
    const renderSkeleton = () => (
        <div style={{padding: '16px'}}>
            {[1, 2, 3].map((i) => (
                <div key={i} style={{marginBottom: 16}}>
                    <Skeleton avatar paragraph={{rows: 2}} active />
                </div>
            ))}
        </div>
    );

    // 渲染空状态
    const renderEmpty = () => (
        <Empty
            description={t('No results found')}
            style={{marginTop: 60}}
        />
    );

    return (
        <div
            ref={containerRef}
            id="searchScrollableDiv"
            className="search-page-container"
            style={{height: containerHeight}}
        >
            <Flex vertical gap={12}>
                {/* 搜索栏 */}
                <Flex gap={8} align="center" className="search-page-header">
                    <Button
                        type="text"
                        icon={<HomeOutlined />}
                        disabled={isLoading}
                        onClick={handleReset}
                        title={t('Home')}
                    />

                    {/* 网站选择下拉框 */}
                    {sourceOptions.length > 1 && (
                        <Select
                            value={state?.currentSource}
                            options={sourceOptions}
                            onChange={handleSourceChange}
                            disabled={isLoading}
                            style={{width: 110}}
                        />
                    )}

                    {/* mod.io 排序（仅当前源为 mod.io 时显示） */}
                    {state?.currentSource === SearchSource.MODIO && (
                        <Select
                            value={`${state?.sortBy ?? 'date'}_${state?.sortOrder ?? 'desc'}`}
                            options={MODIO_SORT_OPTIONS.map((o) => ({
                                value: o.value,
                                label: t(
                                    o.value === 'date_desc'
                                        ? 'Latest'
                                        : o.value === 'downloads_desc'
                                          ? 'Popular'
                                          : o.value === 'rating_desc'
                                            ? 'Top Rated'
                                            : o.value === 'name_asc'
                                              ? 'Name A–Z'
                                              : 'Name Z–A'
                                ),
                            }))}
                            onChange={handleSortChange}
                            disabled={isLoading}
                            style={{width: 120}}
                        />
                    )}

                    <Search
                        placeholder={placeholder}
                        value={searchValue}
                        onChange={handleSearchInputChange}
                        onSearch={handleSearch}
                        disabled={isLoading}
                        allowClear
                        style={{flex: 1}}
                    />

                    <Button
                        type="text"
                        icon={<ReloadOutlined spin={isLoading} />}
                        disabled={isLoading}
                        onClick={handleRefresh}
                        title={t('Refresh')}
                    />
                </Flex>

                {/* 搜索结果列表 */}
                {!isInitialized ? (
                    renderSkeleton()
                ) : items.length === 0 && !isLoading ? (
                    renderEmpty()
                ) : (
                    <InfiniteScroll
                        scrollableTarget="searchScrollableDiv"
                        dataLength={items.length}
                        hasMore={hasMore}
                        loader={
                            <div style={{textAlign: 'center', padding: '20px'}}>
                                <Spin />
                            </div>
                        }
                        endMessage={
                            items.length > 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '20px',
                                        color: '#999',
                                    }}
                                >
                                    {t('No more results')}
                                </div>
                            ) : null
                        }
                        next={loadMore}
                    >
                        <div className="search-result-list">
                            {items.map((item) => (
                                <SearchResultCard
                                    key={item.id}
                                    item={item}
                                    onAdd={handleAdd}
                                    onTranslate={handleTranslate}
                                    onRestore={handleRestore}
                                />
                            ))}
                        </div>
                    </InfiniteScroll>
                )}

                {/* 初始加载指示器 */}
                {isLoading && items.length === 0 && isInitialized && renderSkeleton()}
            </Flex>
        </div>
    );
}

// 导出用于向后兼容的类组件包装器
export class ModioPage extends React.Component {
    render() {
        return <SearchPage />;
    }
}

export default SearchPage;
