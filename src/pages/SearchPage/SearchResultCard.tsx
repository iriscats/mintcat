import React, {memo, useCallback, useState} from 'react';
import {Avatar, Button, Dropdown, Space, Skeleton} from 'antd';
import {DownloadOutlined, LikeOutlined, PlusCircleOutlined, StarFilled, UserOutlined} from '@ant-design/icons';
import {t} from 'i18next';
import {open} from '@tauri-apps/plugin-shell';
import type {MenuProps} from 'antd';
import {SearchResultItem} from '@/apis/search';

interface SearchResultCardProps {
    item: SearchResultItem;
    onAdd: (item: SearchResultItem) => void;
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
    const [thumbnailCacheFailed, setThumbnailCacheFailed] = useState(false);
    const [avatarCacheFailed, setAvatarCacheFailed] = useState(false);

    // 右键菜单项
    const contextMenuItems: MenuProps['items'] = [
        {label: t('action.translateToCurrentLanguage'), key: 'translate'},
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
        onAdd(item);
    }, [item, onAdd]);

    // 处理标题点击
    const handleTitleClick = useCallback(async () => {
        await open(item.profileUrl);
    }, [item.profileUrl]);

    // 优先使用缓存图片；如果缓存文件加载失败，回退到远端 URL，避免坏缓存导致图片闪现后消失。
    const displayThumbnail = !thumbnailCacheFailed && item.cachedThumbnailUrl
        ? item.cachedThumbnailUrl
        : item.thumbnailUrl;
    const displayAvatar = !avatarCacheFailed && item.author.cachedAvatarUrl
        ? item.author.cachedAvatarUrl
        : item.author.avatarUrl;

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
                        {(!displayAvatar || !avatarLoaded) && (
                            <Skeleton.Avatar active size={48} />
                        )}
                        {displayAvatar && (
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
                                        onError={() => {
                                            if (displayAvatar === item.author.cachedAvatarUrl && item.author.avatarUrl) {
                                                setAvatarCacheFailed(true);
                                                setAvatarLoaded(false);
                                                return;
                                            }
                                            setAvatarLoaded(true);
                                        }}
                                    />
                                }
                            />
                        )}
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
                                {item.stats.rating != null && item.stats.rating > 0 && (
                                    <span className="search-result-card-stat search-result-card-rating">
                                        <StarFilled /> {formatRating(item.stats.rating)}
                                    </span>
                                )}
                                {item.author.name && item.author.name !== 'Unknown' && (
                                    <span className="search-result-card-stat">
                                        <UserOutlined /> {item.author.name}
                                    </span>
                                )}
                            </Space>
                        </div>
                    </div>

                    <div className="search-result-card-thumbnail">
                        {(!displayThumbnail || !imageLoaded) && (
                            <Skeleton.Image
                                active
                                style={{width: 160, height: 90}}
                            />
                        )}
                        {displayThumbnail && (
                            <img
                                src={displayThumbnail}
                                alt={item.name}
                                style={{
                                    width: 160,
                                    height: 90,
                                    borderRadius: 4,
                                    objectFit: 'cover',
                                    display: imageLoaded ? 'block' : 'none',
                                }}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    if (displayThumbnail === item.cachedThumbnailUrl && item.thumbnailUrl) {
                                        setThumbnailCacheFailed(true);
                                        setImageLoaded(false);
                                        return;
                                    }
                                    setImageLoaded(true);
                                }}
                            />
                        )}
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

/**
 * 格式化评分（百分比转 5 分制显示）
 * rating 存储为百分比 (0-100)，显示为 X.X/5
 */
function formatRating(rating: number): string {
    const score = rating / 20;
    return score % 1 === 0 ? `${score}/5` : `${score.toFixed(1)}/5`;
}
