import React, {memo, useCallback, useState} from 'react';
import {Avatar, Button, Dropdown, Space, Skeleton} from 'antd';
import {DownloadOutlined, LikeOutlined, PlusCircleOutlined} from '@ant-design/icons';
import {t} from 'i18next';
import {open} from '@tauri-apps/plugin-shell';
import type {MenuProps} from 'antd';
import {SearchResultItem} from '@/apis/search';

interface SearchResultCardProps {
    item: SearchResultItem;
    onAdd: (profileUrl: string) => void;
    onTranslate: (itemId: string) => void;
    onRestore: (itemId: string) => void;
}

/**
 * 搜索结果卡片组件
 * 使用 memo 优化渲染性能
 */
export const SearchResultCard = memo<SearchResultCardProps>(({
    item,
    onAdd,
    onTranslate,
    onRestore,
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [avatarLoaded, setAvatarLoaded] = useState(false);

    // 右键菜单项
    const contextMenuItems: MenuProps['items'] = [
        {label: t('Translate Into Current Language'), key: 'translate'},
        {label: t('Restore'), key: 'restore'},
    ];

    // 处理菜单点击
    const handleMenuClick = useCallback(
        (e: {key: string}) => {
            if (e.key === 'translate') {
                onTranslate(item.id);
            } else if (e.key === 'restore') {
                onRestore(item.id);
            }
        },
        [item.id, onTranslate, onRestore]
    );

    // 处理添加点击
    const handleAddClick = useCallback(() => {
        onAdd(item.profileUrl);
    }, [item.profileUrl, onAdd]);

    // 处理标题点击
    const handleTitleClick = useCallback(async () => {
        await open(item.profileUrl);
    }, [item.profileUrl]);

    // 获取显示的图片 URL
    const displayThumbnail = item.cachedThumbnailUrl || item.thumbnailUrl;
    const displayAvatar = item.author.cachedAvatarUrl || item.author.avatarUrl;

    // 显示的名称和摘要
    const displayName = item.nameTrans || item.name;
    const displaySummary = item.summaryTrans || item.summary;

    return (
        <Dropdown
            trigger={['contextMenu']}
            menu={{
                items: contextMenuItems,
                onClick: handleMenuClick,
            }}
        >
            <div className="search-result-card">
                <div className="search-result-card-content">
                    <div className="search-result-card-avatar">
                        {!avatarLoaded && (
                            <Skeleton.Avatar active size={60} />
                        )}
                        <Avatar
                            style={{
                                width: 60,
                                height: 60,
                                display: avatarLoaded ? 'block' : 'none',
                            }}
                            src={
                                <img
                                    src={displayAvatar}
                                    alt={item.author.name}
                                    onLoad={() => setAvatarLoaded(true)}
                                    onError={() => setAvatarLoaded(true)}
                                />
                            }
                        />
                    </div>

                    <div className="search-result-card-info">
                        <div className="search-result-card-title">
                            <a onClick={handleTitleClick} className="search-result-card-name">
                                {displayName}
                            </a>
                            <Button
                                type="text"
                                size="small"
                                icon={<PlusCircleOutlined />}
                                onClick={handleAddClick}
                                className="search-result-card-add-btn"
                            />
                        </div>

                        <div className="search-result-card-description">
                            {displaySummary}
                        </div>

                        <div className="search-result-card-stats">
                            <Space size="middle">
                                <span className="search-result-card-stat">
                                    <DownloadOutlined /> {formatNumber(item.stats.downloads)}
                                </span>
                                <span className="search-result-card-stat">
                                    <LikeOutlined /> {formatNumber(item.stats.subscribers)}
                                </span>
                            </Space>
                        </div>
                    </div>

                    <div className="search-result-card-thumbnail">
                        {!imageLoaded && (
                            <Skeleton.Image
                                active
                                style={{width: 180, height: 101}}
                            />
                        )}
                        <img
                            src={displayThumbnail}
                            alt={item.name}
                            style={{
                                width: 180,
                                height: 'auto',
                                border: '1px solid #eee',
                                borderRadius: 4,
                                display: imageLoaded ? 'block' : 'none',
                            }}
                            loading="lazy"
                            onLoad={() => setImageLoaded(true)}
                            onError={() => setImageLoaded(true)}
                        />
                    </div>
                </div>
            </div>
        </Dropdown>
    );
});

SearchResultCard.displayName = 'SearchResultCard';

/**
 * 格式化数字（如 1234 -> 1.2K）
 */
function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
